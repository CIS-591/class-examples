// Fetches a student's submission and prepares it for grading.
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { join, relative } from "node:path";
import { runAsync, runSync } from "./proc.mjs";

// Files that decide grades. They are always copied from your checkout over the
// student's, so editing them in a student repo has no effect.
const ROOT_GRADING_PATHS = [
  "vitest.check.config.mts",
  "vitest.setup.ts",
  "scripts/check.mjs",
  "scripts/check-lib.mjs",
  "scripts/grade",
];
const MODULE_GRADING_PATHS = [
  "tests",
  "evals",
  "rubric.md",
  "grading.mjs",
  "checks",
];

/** Every grading path in your checkout, relative to the repo root. */
export function gradingPaths(root) {
  const specs = join(root, "specs");
  const moduleDirs = existsSync(specs)
    ? readdirSync(specs).filter((dir) => dir.startsWith("module-"))
    : [];
  return [
    ...ROOT_GRADING_PATHS,
    ...moduleDirs.flatMap((dir) =>
      MODULE_GRADING_PATHS.map((p) => `specs/${dir}/${p}`),
    ),
  ].filter((path) => existsSync(join(root, path)));
}

function filesUnder(path) {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { recursive: true })
    .map((entry) => join(path, entry))
    .filter((file) => statSync(file).isFile())
    .sort();
}

/** A hash of everything that affects grading, used as part of the cache key. */
export function fingerprint(root, hiddenDir) {
  const hash = createHash("sha256");
  const sources = gradingPaths(root).map((p) => join(root, p));
  if (hiddenDir && existsSync(hiddenDir)) sources.push(hiddenDir);
  for (const file of sources.flatMap(filesUnder)) {
    hash.update(relative(root, file));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex").slice(0, 16);
}

/**
 * Clones a student repo and finds the commit to grade: the last commit before
 * the deadline (or the latest commit if there's no deadline).
 */
export function fetchSubmission({ url, dir, deadline }) {
  try {
    runSync("git", [
      "clone",
      "--quiet",
      "--filter=blob:none",
      "--no-checkout",
      url,
      dir,
    ]);
  } catch {
    return { missing: "repo not found or not accessible" };
  }
  const before = deadline ? [`--before=${deadline.toISOString()}`] : [];
  let sha;
  try {
    sha = runSync("git", ["rev-list", "-n", "1", ...before, "HEAD"], {
      cwd: dir,
    });
  } catch {
    return { missing: "repo has no commits" };
  }
  if (!sha) return { missing: "no commits before the deadline" };
  const late =
    Number(
      runSync("git", ["rev-list", "--count", `${sha}..HEAD`], { cwd: dir }),
    ) > 0;
  const committedAt = runSync("git", ["show", "-s", "--format=%cI", sha], {
    cwd: dir,
  });
  runSync("git", ["checkout", "--quiet", sha], { cwd: dir });
  return { sha, late, committedAt };
}

const lockHash = (dir) => {
  const path = join(dir, "package-lock.json");
  return existsSync(path)
    ? createHash("sha256").update(readFileSync(path)).digest("hex")
    : null;
};

/**
 * Copies your grading files (and hidden tests) over the student's and gives
 * the checkout a node_modules: a link to yours when the lockfile matches,
 * otherwise a fresh `npm ci`.
 */
export async function prepareWorkspace({
  root,
  dir,
  moduleDirName,
  hiddenDir,
}) {
  for (const path of gradingPaths(root)) {
    rmSync(join(dir, path), { recursive: true, force: true });
    cpSync(join(root, path), join(dir, path), { recursive: true });
  }
  if (hiddenDir) {
    const hidden = join(hiddenDir, moduleDirName);
    if (existsSync(hidden)) {
      cpSync(hidden, join(dir, "specs", moduleDirName, "tests", "hidden"), {
        recursive: true,
      });
    }
  }
  rmSync(join(dir, "node_modules"), { recursive: true, force: true });
  if (lockHash(dir) === lockHash(root)) {
    // "junction" works on Windows without admin rights; other systems ignore it.
    symlinkSync(
      join(root, "node_modules"),
      join(dir, "node_modules"),
      "junction",
    );
    return { install: "shared" };
  }
  // Under `npm run`, npm_execpath is npm's own script, which runs without a
  // shell on every system (`npm` alone is npm.cmd on Windows).
  const npm = process.env.npm_execpath;
  const [command, prefix] = npm?.endsWith(".js")
    ? [process.execPath, [npm]]
    : ["npm", []];
  const result = await runAsync(
    command,
    [
      ...prefix,
      "ci",
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
    ],
    { cwd: dir, env: process.env, timeoutMs: 300_000 },
  );
  if (result.status !== 0)
    throw new Error("npm ci failed (the student changed dependencies)");
  return { install: "npm ci" };
}
