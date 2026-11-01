// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Delivery files", () => {
  it("README has setup steps and every environment variable, and no Deploy button", () => {
    const readme = read("README.md");
    expect(readme).not.toContain("vercel.com/new/clone");
    for (const variable of ["GOOGLE_GENERATIVE_AI_API_KEY"]) {
      expect(readme).toContain(variable);
    }
    expect(readme).toContain("~/.codex/config.toml");
  });

  it("devcontainer installs with npm ci and starts the dev server", () => {
    const devcontainer = JSON.parse(read(".devcontainer/devcontainer.json"));
    expect(devcontainer.postCreateCommand).toBe("npm ci");
    expect(devcontainer.postAttachCommand).toBe("npm run dev");
  });

  it("PR template asks for the spec, test evidence, rejected AI code and an architecture note", () => {
    const template = read(".github/pull_request_template.md");
    expect(template).not.toContain("npm run check");
    for (const heading of [
      "Spec",
      "Test evidence",
      "AI-generated code I rejected or corrected",
      "Architecture note",
    ]) {
      expect(template).toContain(`## ${heading}`);
    }
  });

  it.each([
    "docs/copper-state-labs/product-bible.md",
    "docs/README.md",
    "docs/architecture.md",
    "docs/starter-app.md",
    "course.config.json",
  ])("%s exists", (path) => {
    expect(existsSync(path)).toBe(true);
  });

  it("has every script the spec lists", () => {
    const { scripts } = JSON.parse(read("package.json"));
    for (const name of [
      "dev",
      "build",
      "lint",
      "typecheck",
      "test",
      "format",
      "start-module",
      "env:check",
    ]) {
      expect(scripts[name], name).toBeDefined();
    }
  });
});
