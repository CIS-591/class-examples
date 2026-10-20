// Runs spec tests or evals in a student's checkout and turns the Vitest JSON
// report into results: one per acceptance-criterion ID.
import {
  chownSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { brokenFiles } from "../../check-lib.mjs";
import { runAsync } from "../proc.mjs";

export async function runVitest(ctx, paths, env) {
  const present = paths.filter((p) => existsSync(join(ctx.dir, p)));
  if (present.length === 0) return { results: [], errors: [] };

  const outputDir = mkdtempSync(join(tmpdir(), "grade-vitest-"));
  const output = join(outputDir, "results.json");
  // In the grading container, the tests run as the student's own user.
  if (ctx.uid !== undefined) chownSync(outputDir, ctx.uid, ctx.uid);
  const vitest = join(ctx.dir, "node_modules", "vitest", "vitest.mjs");
  const run = await runAsync(
    process.execPath,
    [
      vitest,
      "run",
      "--config",
      "vitest.check.config.mts",
      "--reporter=json",
      `--outputFile=${output}`,
      "--maxWorkers=2",
      "--fsModuleCachePath=.vitest-cache/fs",
      ...present,
    ],
    {
      cwd: ctx.dir,
      env: ctx.uid === undefined ? env : { ...env, HOME: ctx.dir },
      timeoutMs: ctx.timeoutMs,
      uid: ctx.uid,
    },
  );
  const json =
    !run.timedOut && existsSync(output)
      ? JSON.parse(readFileSync(output, "utf8"))
      : null;
  rmSync(outputDir, { recursive: true, force: true });
  if (run.timedOut) {
    return {
      results: [],
      errors: [`timed out after ${ctx.timeoutMs / 1000}s`],
    };
  }
  if (!json) {
    const last = run.stderr.trim().split("\n").slice(-3).join(" ");
    return {
      results: [],
      errors: [`tests didn't run: ${last || "unknown error"}`],
    };
  }

  const byId = new Map();
  for (const file of json.testResults ?? []) {
    for (const test of file.assertionResults ?? []) {
      const id = /\b(AC-[\w.]+)/.exec(test.title)?.[1];
      if (!id) continue;
      const entry = byId.get(id) ?? {
        criterion: id,
        passed: true,
        failures: [],
      };
      if (test.status !== "passed") {
        entry.passed = false;
        const message = (test.failureMessages?.[0] ?? test.status).split(
          "\n",
        )[0];
        entry.failures.push(`${test.title}: ${message}`);
      }
      byId.set(id, entry);
    }
  }
  const results = [...byId.values()].map(({ failures, ...r }) => ({
    ...r,
    detail: r.passed ? "tests passed" : failures.join("; ").slice(0, 300),
  }));
  const errors = brokenFiles(json).map(
    (b) =>
      `${relative(ctx.dir, b.file)} could not run: ${b.message ?? "unknown error"}`,
  );
  return { results, errors };
}
