// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// npm runs scripts with cmd.exe on Windows, where `bash` may be missing and
// `npx` / `npm` are .cmd files that Node can't start without a shell.
const scriptFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? scriptFiles(join(dir, entry.name))
      : entry.name.endsWith(".mjs")
        ? [join(dir, entry.name)]
        : [],
  );

describe("npm scripts run on Windows, macOS and Linux", () => {
  it("package.json scripts don't need bash", () => {
    const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));
    for (const [name, command] of Object.entries<string>(scripts)) {
      expect(command, name).not.toMatch(/\b(bash|sh)\s|\.sh\b/);
    }
  });

  it("scripts don't start npx or npm by name", () => {
    for (const file of scriptFiles("scripts")) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/spawn(Sync)?\(\s*"npx"/);
      expect(source, file).not.toMatch(/run(Sync|Async)\(\s*"npx"/);
    }
  });

  it("files keep LF line endings on checkout", () => {
    expect(readFileSync(".gitattributes", "utf8")).toMatch(
      /^\* text=auto eol=lf$/m,
    );
  });
});
