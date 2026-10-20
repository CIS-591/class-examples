// npm run grade: grades every student's copper-mN repo for one module.
//
//   npm run grade -- --roster ~/cis591/roster.csv --deadline 2026-11-03T23:59-07:00
//
// Options:
//   --roster <csv>         required; columns: name, github, vercel_url (optional)
//   --module <n>           default: "module" in course.config.json
//   --deadline <date>      grade the last commit before this time (ISO 8601)
//   --hidden <dir>         hidden tests: <dir>/<module folder>/*.test.ts(x)
//   --out <dir>            default: .grading/module-<n> (gitignored)
//   --concurrency <n>      students graded at once (default: half your CPU cores)
//   --evals                also run AI evals (needs GRADING_AI_GATEWAY_API_KEY)
//   --only <a,b>           grade only these GitHub usernames
//   --no-cache             grade everyone again
//   --keep                 keep the temporary checkouts (for debugging)
//   --repo-template <url>  default: https://github.com/{github}/{prefix}{module}.git
//
// Student code runs as you here. To grade real students, use
// `npm run grade:docker`, which runs this inside a throwaway container.
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  realpathSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { moduleDir } from "../check-lib.mjs";
import { createCache } from "./cache.mjs";
import { loadModuleConfig } from "./config.mjs";
import { pool } from "./pool.mjs";
import { ghApi, runSync } from "./proc.mjs";
import { writeReports } from "./report.mjs";
import { score } from "./rubric.mjs";
import { loadRoster } from "./roster.mjs";
import {
  fetchSubmission,
  fingerprint,
  prepareWorkspace,
} from "./workspace.mjs";

const { values: opts } = parseArgs({
  options: {
    roster: { type: "string" },
    module: { type: "string" },
    deadline: { type: "string" },
    hidden: { type: "string" },
    out: { type: "string" },
    concurrency: { type: "string" },
    evals: { type: "boolean", default: false },
    only: { type: "string" },
    "no-cache": { type: "boolean", default: false },
    keep: { type: "boolean", default: false },
    "repo-template": { type: "string" },
    root: { type: "string" },
  },
});

const fail = (message) => {
  console.error(`grade: ${message}`);
  process.exit(1);
};

const root = resolve(opts.root ?? process.cwd());
const course = JSON.parse(
  readFileSync(join(root, "course.config.json"), "utf8"),
);
const moduleNumber =
  opts.module === undefined ? course.module : Number(opts.module);
if (!opts.roster)
  fail("pass --roster <csv> (columns: name, github, vercel_url)");
const moduleDirName = moduleDir(moduleNumber, readdirSync(join(root, "specs")));
if (!moduleDirName) fail(`no specs/module-${moduleNumber} folder in ${root}`);
const deadline = opts.deadline ? new Date(opts.deadline) : null;
if (deadline && Number.isNaN(deadline.getTime()))
  fail(`bad --deadline "${opts.deadline}"`);

const config = await loadModuleConfig(root, moduleDirName, {
  evals: opts.evals,
});
const specDirs = readdirSync(join(root, "specs"));
const repoName = `${course.repoPrefix}${moduleNumber}`;
const template =
  opts["repo-template"] ?? "https://github.com/{github}/{repo}.git";
const finalOut = resolve(
  opts.out ?? join(root, ".grading", `module-${moduleNumber}`),
);
// In the grading container (Dockerfile.grader) the grader runs as root and
// each student's code runs as its own user, which can't touch the grader, the
// shared packages, other students' checkouts or the results. Results are built
// in a private folder and copied out at the end.
const uidBase = Number(process.env.GRADE_STUDENT_UID_BASE);
const isolated = uidBase > 0 && process.getuid?.() === 0;
const outDir = isolated ? mkdtempSync(join(tmpdir(), "grade-out-")) : finalOut;
if (isolated && existsSync(join(finalOut, "cache"))) {
  cpSync(join(finalOut, "cache"), join(outDir, "cache"), { recursive: true });
}
// Where the results end up, as you'd see the path (the container's /results
// is a folder on your computer).
const outLabel = process.env.GRADE_OUT_LABEL ?? finalOut;
const hiddenDir = opts.hidden ? resolve(opts.hidden) : null;
const only = opts.only
  ? new Set(opts.only.split(",").map((s) => s.trim()))
  : null;
const roster = loadRoster(opts.roster).filter(
  (s) => !only || only.has(s.github),
);
const concurrency = Number(
  opts.concurrency ?? Math.max(2, Math.floor(availableParallelism() / 2)),
);
const cache = createCache(join(outDir, "cache"), !opts["no-cache"]);
const gradingPrint = fingerprint(root, hiddenDir);
// The real path: on Windows, tmpdir() can be a short name (C:\\Users\\RUNNER~1)
// that Vite resolves differently, so it can't find the test setup file.
const work = realpathSync.native(
  mkdtempSync(join(tmpdir(), `grade-m${moduleNumber}-`)),
);
if (isolated) chmodSync(work, 0o711);
const started = performance.now();
let fromCache = 0;

console.log(
  `Grading module ${moduleNumber} (${moduleDirName}) for ${roster.length} students, ` +
    `${concurrency} at a time. Checks: ${config.checks.map((c) => c.id).join(", ")}.` +
    (isolated ? " Student code runs as separate users." : ""),
);

async function gradeStudent(student) {
  const notes = [];
  const url = template
    .replaceAll("{github}", student.github)
    .replaceAll("{repo}", repoName)
    .replaceAll("{module}", String(moduleNumber));
  const dir = join(work, student.github);
  const uid = isolated ? uidBase + roster.indexOf(student) : undefined;
  const submission = fetchSubmission({ url, dir, deadline });
  if (submission.missing) {
    return { student, status: "no submission", notes: [submission.missing] };
  }

  const ctx = {
    student,
    owner: student.github,
    repoName,
    sha: submission.sha,
    module: moduleNumber,
    moduleDirName,
    specDirs,
    dir,
    uid,
    root,
    settings: config.settings,
    timeoutMs: config.timeoutMs,
    gh: ghApi,
    fetch: globalThis.fetch,
    previous: [],
  };

  let prepared = false;
  for (const check of config.checks) {
    const key = createHash("sha256")
      .update(`${submission.sha}:${gradingPrint}:${check.id}`)
      .digest("hex");
    let outcome = check.cache ? cache.get(student.github, check.id, key) : null;
    if (outcome) {
      fromCache++;
    } else {
      try {
        if (check.needsWorkspace && !prepared) {
          const { install } = await prepareWorkspace({
            root,
            dir,
            moduleDirName,
            hiddenDir,
          });
          if (install !== "shared")
            notes.push(`dependencies changed, ran ${install}`);
          // -h: change the node_modules link itself, never your packages.
          if (isolated) runSync("chown", ["-R", "-h", `${uid}:${uid}`, dir]);
          prepared = true;
        }
        outcome = await check.run(ctx);
      } catch (error) {
        outcome = {
          results: [],
          errors: [`${check.id} check failed: ${error.message}`],
        };
      }
      if (check.cache) cache.set(student.github, check.id, key, outcome);
    }
    ctx.previous.push(...outcome.results);
    notes.push(...outcome.errors);
  }

  return {
    student,
    status: submission.late ? "late" : "on time",
    sha: submission.sha,
    committedAt: submission.committedAt,
    score: score(config.rubric, ctx.previous),
    notes,
  };
}

try {
  const graded = await pool(roster, concurrency, async (student) => {
    const result = await gradeStudent(student);
    const points = result.score
      ? `${result.score.autoEarned}/${result.score.autoMax}`
      : "-";
    console.log(
      `  ${student.github.padEnd(24)} ${result.status.padEnd(14)} ${points}`,
    );
    return result;
  });
  writeReports(outDir, moduleNumber, config.rubric, graded);
  if (isolated) {
    // Replace whatever is there, including anything student code left behind.
    for (const entry of existsSync(finalOut) ? readdirSync(finalOut) : []) {
      rmSync(join(finalOut, entry), { recursive: true, force: true });
    }
    cpSync(outDir, finalOut, { recursive: true });
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(
    `\nDone in ${seconds}s (${fromCache} check results from cache).\n` +
      `Grades:   ${join(outLabel, "grades.csv")}\nFeedback: ${join(outLabel, "feedback")}/`,
  );
} finally {
  if (!opts.keep) rmSync(work, { recursive: true, force: true });
  if (isolated) rmSync(outDir, { recursive: true, force: true });
}
