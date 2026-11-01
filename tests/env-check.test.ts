// @vitest-environment node
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tempDir } from "./helpers/temp-dir";

// Deliberately not shaped like a real provider key, so secret scanners ignore it.
const KEY = "test-only-not-a-real-key-0123456789wxyz";

function check(contents?: string) {
  const file = join(tempDir("env-check-"), ".env.local");
  if (contents !== undefined) writeFileSync(file, contents);
  const result = spawnSync(process.execPath, ["scripts/check-env.mjs", file], {
    encoding: "utf8",
  });
  return { code: result.status, out: result.stdout + result.stderr };
}

describe("npm run env:check", () => {
  it("says so when there's no .env.local", () => {
    const { code, out } = check();
    expect(code).toBe(1);
    expect(out).toContain("not found");
  });

  it("shows the name and only the ends of a long value", () => {
    const { code, out } = check(`GOOGLE_GENERATIVE_AI_API_KEY=${KEY}\n`);
    expect(code).toBe(0);
    expect(out).toContain(
      `GOOGLE_GENERATIVE_AI_API_KEY=test...wxyz (${KEY.length} characters)`,
    );
    expect(out).not.toContain(KEY);
    expect(out).toContain("1 variable in");
  });

  it("hides short values completely", () => {
    const { out } = check("DB_PASSWORD=hunter2hunter2\n");
    expect(out).toContain("DB_PASSWORD=(hidden, 14 characters)");
    expect(out).not.toContain("hunt");
  });

  it("marks empty values", () => {
    expect(check("EMPTY=\n").out).toContain("EMPTY=(empty)");
  });

  it("handles quotes, export, comments, blank lines and CRLF", () => {
    const { out } = check(
      `# a comment\r\n\r\nexport A="${KEY}"\r\nB='${KEY}'\r\nC=${KEY} # note\r\n`,
    );
    for (const name of ["A", "B", "C"]) {
      expect(out).toContain(`${name}=test...wxyz (${KEY.length} characters)`);
    }
    expect(out).toContain("3 variables in");
    expect(out).not.toContain(KEY);
    expect(out).not.toContain("a comment");
  });

  it("keeps = inside a value as part of the value", () => {
    const value = "c2VjcmV0LXZhbHVlLXdpdGgtcGFkZGluZw==";
    const { out } = check(`TOKEN=${value}\n`);
    expect(out).toContain(`TOKEN=c2Vj...Zw== (${value.length} characters)`);
    expect(out).not.toContain(value);
  });

  it("never prints the inner lines of a multi-line quoted value", () => {
    const inner = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC=";
    const { out } = check(
      `PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n${inner}\n-----END PRIVATE KEY-----"\nNEXT=ok\n`,
    );
    expect(out).not.toContain(inner);
    expect(out).not.toContain("MIIEvQ");
    expect(out).toMatch(/PRIVATE_KEY=----\.\.\.---- \(\d+ characters\)/);
    expect(out).toContain("NEXT=(hidden, 2 characters)");
  });

  it("skips lines that aren't NAME=value without printing them", () => {
    const { out } = check(`${KEY}\nnot a name=${KEY}\nGOOD=x\n`);
    expect(out).not.toContain(KEY);
    expect(out).not.toContain("not a name");
    expect(out).toContain("(skipped line 1: not NAME=value)");
    expect(out).toContain("(skipped line 2: not NAME=value)");
    expect(out).toContain("1 variable in");
  });

  it("doesn't hang or leak on an unclosed quote", () => {
    const { code, out } = check(`OPEN="${KEY}\nREST=more\n`);
    expect(code).toBe(0);
    expect(out).not.toContain(KEY);
  });
});
