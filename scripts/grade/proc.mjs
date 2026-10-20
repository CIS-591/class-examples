// Small process helpers for the grader.
import { spawn, spawnSync } from "node:child_process";

/** Runs a command and returns its output; throws with stderr if it fails. */
export function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || "")
      .trim()
      .split("\n")
      .pop();
    throw new Error(`${command} ${args[0]} failed: ${message}`);
  }
  return result.stdout.trim();
}

/**
 * Runs a command without blocking, killing it after timeoutMs. With `uid`, it
 * runs as that user (the grading container runs student code this way).
 */
export function runAsync(
  command,
  args,
  { cwd, env, timeoutMs = 180_000, uid } = {},
) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      ...(uid === undefined ? {} : { uid, gid: uid }),
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr, timedOut });
    });
  });
}

/**
 * Environment for running student code: only what tools need, so no keys or
 * tokens from your shell reach code you're grading.
 */
export function safeEnv(extra = {}) {
  // The last four are what Node and npm need on Windows.
  const keep = [
    "PATH",
    "HOME",
    "TMPDIR",
    "LANG",
    "SYSTEMROOT",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "TEMP",
  ];
  const env = Object.fromEntries(
    keep
      .filter((key) => process.env[key])
      .map((key) => [key, process.env[key]]),
  );
  return { ...env, NODE_ENV: "test", CI: "1", ...extra };
}

/** Calls `gh api <path>` and parses the JSON. Uses your gh login. */
export async function ghApi(path) {
  const result = await runAsync("gh", ["api", path], {
    env: process.env,
    timeoutMs: 30_000,
  });
  if (result.status !== 0) {
    throw new Error(
      `gh api ${path} failed: ${result.stderr.trim() || "no output"}`,
    );
  }
  return JSON.parse(result.stdout);
}
