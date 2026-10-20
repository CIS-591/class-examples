// npm run start-module: run once, right after cloning a module branch.
// Makes the branch your local main, keeps the course repo as the "course" remote,
// and creates your public copper-mN repo on GitHub and pushes to it.
// If a step fails, fix the problem and run it again: it picks up where it stopped.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function fail(message) {
  console.error(`start-module: ${message}`);
  process.exit(1);
}

// git and gh are .exe files on Windows, so they run without a shell everywhere.
// Tests set START_MODULE_FAKE_GH to a Node script that stands in for gh.
function run(command, args, { quiet = false, show = false } = {}) {
  const fakeGh = command === "gh" && process.env.START_MODULE_FAKE_GH;
  const result = fakeGh
    ? spawnSync(process.execPath, [fakeGh, ...args], { encoding: "utf8" })
    : spawnSync(command, args, {
        encoding: "utf8",
        stdio: [
          "inherit",
          show ? "inherit" : "pipe",
          quiet ? "pipe" : "inherit",
        ],
      });
  if (result.error?.code === "ENOENT") return { ok: false, missing: true };
  return { ok: result.status === 0, stdout: (result.stdout ?? "").trim() };
}

function git(...args) {
  const result = run("git", args);
  if (!result.ok) fail(`git ${args.join(" ")} failed.`);
  return result.stdout;
}
const hasRemote = (name) =>
  run("git", ["remote", "get-url", name], { quiet: true }).ok;

const top = run("git", ["rev-parse", "--show-toplevel"], { quiet: true });
if (!top.ok) fail("run this inside the folder you cloned.");
process.chdir(top.stdout);

const course = JSON.parse(
  readFileSync(join(top.stdout, "course.config.json"), "utf8"),
);
const repo = `${course.repoPrefix}${course.module}`;

const auth = run("gh", ["auth", "status"], { quiet: true });
if (auth.missing) fail("install the GitHub CLI first: https://cli.github.com");
if (!auth.ok) fail("log in to GitHub first: gh auth login");
if (hasRemote("course") && hasRemote("origin")) {
  fail('this clone is already set up (it has "course" and "origin" remotes).');
}

const owner = run("gh", ["api", "user", "--jq", ".login"]).stdout;

git("branch", "-M", "main");
if (!hasRemote("course")) git("remote", "rename", "origin", "course");

if (!run("gh", ["repo", "view", `${owner}/${repo}`], { quiet: true }).ok) {
  if (!run("gh", ["repo", "create", repo, "--public"]).ok) {
    fail(
      `could not create ${repo} on GitHub. Fix the problem above, then run npm run start-module again.`,
    );
  }
}

const protocol = run("gh", ["config", "get", "git_protocol"], { quiet: true });
const field = protocol.stdout === "ssh" ? "sshUrl" : "url";
const url = run("gh", [
  "repo",
  "view",
  `${owner}/${repo}`,
  "--json",
  field,
  "--jq",
  `.${field}`,
]);
git("remote", "add", "origin", url.stdout);
if (!run("git", ["push", "-u", "origin", "main"], { show: true }).ok) {
  run("git", ["remote", "remove", "origin"]);
  fail(
    `could not push to ${owner}/${repo}. If that repo already has other work in it, delete it on GitHub (Settings > Delete this repository), then run npm run start-module again.`,
  );
}

console.log(`Done: https://github.com/${owner}/${repo}`);
