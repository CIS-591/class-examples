// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tempDir } from "./helpers/temp-dir";

const script = join(process.cwd(), "scripts/start-module.mjs");

// A throwaway clone of a "module-3" branch, plus a fake `gh` (a Node script) that records its
// arguments instead of talking to GitHub. The student's "GitHub" repo is a
// local bare repo, which exists once `gh repo create` has run.
function setup({ failCreate = false, exists = false } = {}) {
  const root = tempDir("start-module-");
  const course = join(root, "course.git");
  const student = join(root, "student.git");
  const clone = join(root, "clone");
  const bin = join(root, "bin");
  const log = join(root, "gh.log");
  const created = join(root, "created");
  const failFlag = join(root, "fail-create");
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, stdio: "pipe" });

  git(root, "init", "--bare", "-q", course);
  git(root, "init", "--bare", "-q", student);
  if (exists) writeFileSync(created, "");
  if (failCreate) writeFileSync(failFlag, "");
  mkdirSync(clone);
  git(clone, "init", "-q", "-b", "module-3");
  git(clone, "remote", "add", "origin", course);
  writeFileSync(
    join(clone, "course.config.json"),
    JSON.stringify({ module: 3, repoPrefix: "copper-m" }),
  );
  mkdirSync(join(clone, "scripts"));
  copyFileSync(script, join(clone, "scripts/start-module.mjs"));
  git(clone, "add", ".");
  git(
    clone,
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@example.com",
    "commit",
    "-qm",
    "start",
  );

  mkdirSync(bin);
  const fakeGh = join(bin, "gh.mjs");
  writeFileSync(
    fakeGh,
    `import { appendFileSync, existsSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(log)}, "gh " + args.join(" ") + "\\n");
const created = existsSync(${JSON.stringify(created)});
switch (args.slice(0, 2).join(" ")) {
  case "api user":
    console.log("student-1");
    break;
  case "repo view":
    if (!created) process.exit(1);
    if (args.includes("--json")) console.log(${JSON.stringify(student)});
    break;
  case "repo create":
    if (existsSync(${JSON.stringify(failFlag)})) process.exit(1);
    writeFileSync(${JSON.stringify(created)}, "");
    break;
}
`,
  );

  const run = () =>
    spawnSync(process.execPath, ["scripts/start-module.mjs"], {
      cwd: clone,
      env: { ...process.env, START_MODULE_FAKE_GH: fakeGh },
      encoding: "utf8",
    });
  const gitOut = (...args: string[]) =>
    git(clone, ...args)
      .toString()
      .trim();
  const pushed = () =>
    git(student, "branch", "--list", "main").toString().includes("main");
  const ghLog = () => (existsSync(log) ? readFileSync(log, "utf8") : "");
  const allowCreate = () => rmSync(failFlag, { force: true });
  return { run, gitOut, ghLog, pushed, allowCreate };
}

describe("npm run start-module", () => {
  it("makes main, keeps the course remote, and creates and pushes the public repo", () => {
    const { run, gitOut, ghLog, pushed } = setup();
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(gitOut("branch", "--show-current")).toBe("main");
    expect(gitOut("remote").split("\n").sort()).toEqual(["course", "origin"]);
    expect(ghLog()).toContain("gh repo create copper-m3 --public");
    expect(ghLog()).not.toContain("collaborators");
    expect(pushed()).toBe(true);
  });

  it("refuses to run twice", () => {
    const { run } = setup();
    run();
    const second = run();
    expect(second.status).toBe(1);
    expect(second.stderr).toContain("already set up");
  });

  it("can be run again after creating the repo failed", () => {
    const { run, gitOut, pushed, allowCreate } = setup({ failCreate: true });
    const first = run();
    expect(first.status).toBe(1);
    expect(first.stderr).toContain("run npm run start-module again");
    expect(gitOut("remote")).toBe("course");

    allowCreate();
    const second = run();
    expect(second.status, second.stderr).toBe(0);
    expect(pushed()).toBe(true);
  });

  it("uses a repo that already exists on GitHub instead of creating it", () => {
    const { run, ghLog, pushed } = setup({ exists: true });
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(ghLog()).not.toContain("repo create");
    expect(pushed()).toBe(true);
  });
});
