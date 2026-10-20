// Applies every migration in supabase/migrations, plus the seed, to the
// Supabase project in SUPABASE_DB_URL. Run with: npm run db:migrate
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    [
      "Set up Supabase to run migrations.",
      "Add SUPABASE_DB_URL to .env.local. In the Supabase dashboard, open",
      "Connect > Direct connection and copy the connection string (with your database password).",
    ].join("\n"),
  );
  process.exit(1);
}

// The project's Supabase CLI, run with this Node: `npx` needs a shell on Windows.
const require = createRequire(join(process.cwd(), "package.json"));
const pkg = require.resolve("supabase/package.json");
const cli = join(
  dirname(pkg),
  JSON.parse(readFileSync(pkg, "utf8")).bin.supabase,
);
const result = spawnSync(
  process.execPath,
  [cli, "db", "push", "--db-url", dbUrl, "--include-seed", "--yes"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
