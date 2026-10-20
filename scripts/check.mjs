// npm run check: runs this module's spec tests and evals (plus earlier modules'
// tests) and prints a pass/fail checklist of acceptance criteria.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  brokenFiles,
  checkPaths,
  criteriaFrom,
  moduleDir,
  report,
} from "./check-lib.mjs";
import { loadRubric } from "./grade/rubric.mjs";

const { module } = JSON.parse(readFileSync("course.config.json", "utf8"));
const paths = checkPaths(module).filter((p) => existsSync(p));
if (paths.length === 0) {
  console.error(`No tests found for module ${module} in specs/.`);
  process.exit(1);
}

const output = join(mkdtempSync(join(tmpdir(), "check-")), "results.json");
// Vitest's own script, run with this Node: `npx` needs a shell on Windows.
spawnSync(
  process.execPath,
  [
    join("node_modules", "vitest", "vitest.mjs"),
    "run",
    "--config",
    "vitest.check.config.mts",
    "--reporter=json",
    `--outputFile=${output}`,
    ...paths,
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);
if (!existsSync(output)) {
  console.error(
    "The tests didn't run. Try `npm ci`, then run `npm run check` again.",
  );
  process.exit(1);
}

const results = JSON.parse(readFileSync(output, "utf8"));
const criteria = criteriaFrom(results);
const broken = brokenFiles(results);
const dir = moduleDir(module);
const rubric = dir ? loadRubric(join("specs", dir)) : [];
console.log(report(module, criteria, broken, rubric));
const allPassed = criteria.length > 0 && criteria.every((c) => c.passed);
process.exit(allPassed && broken.length === 0 ? 0 : 1);
