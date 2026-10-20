// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tempDir } from "./helpers/temp-dir";

const script = join(process.cwd(), "scripts/db-migrate.mjs");

function run(env: Record<string, string>) {
  // A project whose fake Supabase CLI prints its arguments instead of touching
  // a database.
  const project = tempDir("fake-supabase-");
  const pkg = join(project, "node_modules", "supabase");
  mkdirSync(join(pkg, "dist"), { recursive: true });
  writeFileSync(join(project, "package.json"), "{}");
  writeFileSync(
    join(pkg, "package.json"),
    JSON.stringify({ name: "supabase", bin: { supabase: "dist/supabase.js" } }),
  );
  writeFileSync(
    join(pkg, "dist", "supabase.js"),
    'console.log(["supabase", ...process.argv.slice(2)].join(" "));\n',
  );
  return spawnSync(process.execPath, [script], {
    cwd: project,
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
  });
}

describe("npm run db:migrate", () => {
  it("explains how to set up Supabase when SUPABASE_DB_URL is missing", () => {
    const result = run({});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Set up Supabase");
  });

  it("pushes migrations and the seed to SUPABASE_DB_URL", () => {
    const result = run({ SUPABASE_DB_URL: "postgresql://example" });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      "supabase db push --db-url postgresql://example --include-seed --yes",
    );
  });
});
