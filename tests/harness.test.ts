// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settings = JSON.parse(readFileSync(".claude/settings.json", "utf8"));
const mcp = JSON.parse(readFileSync(".mcp.json", "utf8"));
const agents = readFileSync("AGENTS.md", "utf8");

describe("Agent harness", () => {
  it("blocks reading .env files", () => {
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining(["Read(./.env)", "Read(./.env.*)"]),
    );
  });

  it("allows the test, lint and typecheck commands", () => {
    expect(settings.permissions.allow).toEqual(
      expect.arrayContaining([
        "Bash(npm test)",
        "Bash(npm run lint)",
        "Bash(npm run typecheck)",
        "Bash(npm run env:check)",
      ]),
    );
  });

  it("configures the shadcn and docs MCP servers", () => {
    expect(Object.keys(mcp.mcpServers).sort()).toEqual([
      "next-devtools",
      "shadcn",
    ]);
  });

  it("CLAUDE.md uses the same rules as AGENTS.md", () => {
    expect(readFileSync("CLAUDE.md", "utf8").trim()).toBe("@AGENTS.md");
  });

  it.each([
    "Just build it",
    "Never hand the student an open decision",
    "Clear blockers yourself",
    "AskUserQuestion",
    "npm test",
    "components/ui",
    "lib/ai/call.ts",
    ".env",
    "conflicting or outdated facts in the Product Bible",
    "public/docs/",
    "lib/copper/assistant/",
    "npm run env:check",
  ])("AGENTS.md covers %s", (rule) => {
    expect(agents).toContain(rule);
  });
});
