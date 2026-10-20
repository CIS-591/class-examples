# Spec: Copper State Labs Base Repo

_The spec the starter app was built from. It was handed to Claude Code one build step at a time (see "Build order"). For how the app fits together now, see [architecture.md](architecture.md)._

## 1. Purpose

A Next.js starter that every CIS 591 student clones in Module 0. It deploys to Vercel with no setup, carries the Copper State Labs brand and data, and contains the shared tools (UI kit, Supabase helpers, AI wrapper with cost logging, tests, CI, agent rules) that every class example builds on.

## 2. Users

- **Students** (mixed business and technical) cloning, running and deploying the app, mostly through Claude Code or Codex.
- **The instructor and TAs**, adding module starters and grading against tests.

## 3. Requirements

### 3.1 Stack and versions

- Next.js (App Router), TypeScript in strict mode, Tailwind CSS v4, shadcn/ui, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Vercel AI SDK, zod, Vitest, React Testing Library.
- Node version pinned in `.nvmrc` and `package.json` `engines`. npm with a committed `package-lock.json`. All dependency versions pinned exactly (no `^` or `~`). Record the chosen versions in this spec's change log.

### 3.2 Placeholder home page (Module 0 "Hello, Copper State Labs")

The base ships a deliberately minimal page. Students build the real landing page in Module 1.

- Logo, the heading "Copper State Labs", and the line "Our new site is under construction."
- One clearly marked line of text that the Module 0 readiness task asks students to change.
- Footer: "Fictional — for educational use."
- No product sections, pricing or marketing copy (those are Module 1).

### 3.3 Brand

- shadcn theme built from the Product Bible colors: Copper `#B87333` (primary), Patina Teal `#4A8C82` (accent), Desert Sand `#EFE3D0`, Sonoran Sunset `#E8663D`, Night Sky `#1C2333`, Hard-Hat Yellow `#F2C230`. Light and dark modes via next-themes.
- Rounded geometric sans for headings, humanist sans for body, both via `next/font`.
- `components/copper/`: `Logo`, `SiteHeader`, `SiteFooter`.

### 3.4 UI kit

- shadcn components pre-added: button, card, input, textarea, label, select, badge, tabs, table, dialog, sheet, dropdown-menu, field, sonner, skeleton, scroll-area, separator, tooltip, avatar, progress, chart.
- AI Elements components for conversation, message, prompt input, sources and tool display.
- Also installed: lucide-react, recharts, @tanstack/react-table, react-hook-form, @hookform/resolvers, date-fns.

### 3.5 Supabase

- `lib/supabase/client.ts` and `lib/supabase/server.ts`.
- Migrations creating the Product Bible tables `products`, `plans`, `assistant_versions` and `ai_tiers` exactly as in Bible Section 10, plus `ai_calls` (section 3.6). pgvector extension enabled.
- `supabase/seed.sql` generated from Bible Section 10, matching it exactly.
- No authentication and no row-level security policies yet (a later module).

### 3.6 AI wrapper and cost logging

- `lib/ai/models.ts`: the course's approved models, each with an id and a label.
- `lib/ai/pricing.ts`: input and output price per million tokens for each approved model.
- `lib/ai/call.ts`: wraps text generation and structured-object generation. Every call records `module`, `feature`, `model`, `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`, `ok`, `created_at` in `ai_calls`.
- If Supabase isn't configured, the wrapper logs to the console instead of failing.
- All model access goes through one gateway key read from an environment variable.

### 3.7 Works with no configuration

- `npm run build` succeeds and the home page renders with no environment variables set.
- Any page that needs Supabase or a model key shows a friendly "Set up X to use this page" card instead of crashing.

### 3.8 Agent harness

- Root `CLAUDE.md`:
  - plan before coding, and wait for approval of the plan
  - every change comes with tests; run `npm test` before saying a task is done
  - use components from `components/ui` and `components/ai-elements`; don't add UI libraries
  - all AI calls go through `lib/ai/call.ts`
  - never read, print or commit `.env` files
  - conflicting or outdated facts in the Product Bible are intentional; never correct, remove or reconcile them
  - don't change files under `specs/*/tests` or `specs/*/evals`
- `AGENTS.md` with the same rules (for Codex).
- `.claude/settings.json`: deny reading `.env*`; allow `npm test`, `npm run lint`, `npm run typecheck`.
- `.mcp.json`: shadcn MCP server, a docs MCP server, and the Supabase MCP server in read-only mode.

### 3.9 Quality and delivery

- Scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `format`, `check`.
- `npm run check` runs the current module's `specs/module-N/tests` and `evals`, plus all earlier modules' tests, and prints a checklist of acceptance-criterion IDs (for example `AC-3.2`) marked pass or fail, plus a summary line. Ship `specs/module-0/` with one passing and one failing criterion to demonstrate it. `npm test` excludes `specs/`, so the sample's failing criterion doesn't break CI.
- `npm run start-module` (`scripts/start-module.mjs`): run right after cloning a module branch; makes it the local `main`, renames the clone's remote to `course`, creates the student's **public** `copper-mN` with `gh` (or uses it if it already exists) and pushes. If a step fails, running it again picks up where it stopped. The module number comes from `course.config.json`.
- `npm run grade` (`scripts/grade/`): instructor-only. For each student in a roster CSV (kept outside the repo), grades the last commit before a deadline in parallel: copies the instructor's grading files over the student's, reuses the instructor's `node_modules`, runs the module's checks with no secrets in the environment, caches by commit, and writes `grades.csv` and per-student feedback. Scores come from each module's `rubric.md` (`Criterion | Points | Graded by | Description`). Built-in checks: `tests`, `deploy` (live Vercel production deployment, found through GitHub's deployment records or the roster's `vercel_url`) and `evals` (opt-in). Modules add checks and settings in `specs/module-N/grading.mjs` and `specs/module-N/checks/` without changing the grader. `npm run check` shows rubric points too.
- `npm run grade:docker` (`Dockerfile.grader`): instructor-only, and the way to grade real students. Runs `npm run grade` in a throwaway container that receives only a read-only `GH_TOKEN` (plus `GRADING_AI_GATEWAY_API_KEY` with `--evals`), the roster and hidden tests read-only, and the results folder. Inside, each student's code runs as its own user and can't modify the grader, packages, results or other students' checkouts, or read the token.
- `npm run db:migrate` applies all migrations in `supabase/migrations` to the project in the environment variables, so each module's checkpoint can add its tables to the student's existing Supabase project.
- `.github/workflows/ci.yml` runs `npm ci`, lint, typecheck and tests on pushes and pull requests.
- `.github/pull_request_template.md`: link to the spec, test evidence, "AI-generated code I rejected or corrected", architecture note.
- `.devcontainer/devcontainer.json` that runs `npm ci` on create.
- `README.md`: local setup in five steps or fewer, environment variables table, Codex MCP note.
- `docs/copper-state-labs/product-bible.md` (the Product Bible), `docs/architecture.md` and `docs/README.md`.
- `specs/README.md` explaining a module folder: `spec.md`, `instructions.md`, `assets/`, `data/`, `evals/`, `tests/`, `rubric.md`, `reflection.md`, optional `CLAUDE.md`.

## 4. Acceptance criteria

1. A fresh clone runs `npm ci && npm run build` with no environment variables, and the build succeeds.
2. With no environment variables, the placeholder home page renders the logo, the under-construction line, the Week 0 check-in line and the fictional-use footer.
3. `npm run lint`, `npm run typecheck` and `npm test` all pass, and CI passes on a pull request.
4. After running the migrations and seed against a new Supabase project, the four Bible tables match Bible Section 10 row for row (checked by a test that reads the seed data).
5. With a gateway key and Supabase set, a test call through `lib/ai/call.ts` writes one row to `ai_calls` with tokens, cost and latency filled in.
6. With no Supabase configured, the same call logs to the console and does not throw.
7. `package.json` contains no `^` or `~` versions, and `package-lock.json` is committed.
8. Claude Code started in the repo cannot read `.env.local` (blocked by settings), and lists the three MCP servers.
9. Importing the student's repo at vercel.com/new produces a working site with no environment variables entered.
10. Opening the repo in GitHub Codespaces reaches a running dev server with no manual installs.
11. `npm run check` on the base repo (sample module only) prints one passing and one failing criterion by ID, with a summary line.

## 5. Non-goals

- No class-example features (modules are added later as starters).
- No authentication, row-level security, or Realtime.
- No agent framework.
- No real Copper State Labs products, logos or trademarks of real companies.

## 6. Build order for Claude Code

Ask Claude Code to do one step at a time, plan first, and commit after you review each:

1. Scaffold Next.js, TypeScript, Tailwind, ESLint, Prettier, Vitest; pin versions; CI workflow. (Criteria 1, 3, 7) Because the repo already contains `specs/` and `docs/`, run `create-next-app` in a temporary folder and move the result into the repo root rather than scaffolding in place.
2. shadcn init with the Copper theme, components, AI Elements, and the other UI libraries. (3.3, 3.4)
3. Home page and brand components. (Criterion 2)
4. Supabase helpers, migrations, seed, the seed test and `npm run db:migrate`. (Criterion 4)
5. AI wrapper, pricing, `ai_calls` logging and its tests. (Criteria 5, 6)
6. Agent harness: `CLAUDE.md`, `AGENTS.md`, settings, `.mcp.json`. (Criterion 8)
7. README, devcontainer, PR template, docs, `specs/README.md`, `course.config.json`, `npm run check` with `specs/module-0/`, and `npm run start-module`. (Criteria 9, 10, 11)

## 7. Change log

| Date | Change |
|---|---|
| 2026-10-10 | Draft created |
| 2026-10-10 | Step 1 versions: Node 24 (`.nvmrc`, `engines` `24.x`), next 16.4.0, react / react-dom 19.3.0, typescript 5.9.3, tailwindcss / @tailwindcss/turbopack 4.3.3, eslint 9.39.5, eslint-config-next 16.4.0, eslint-config-prettier 10.1.8, prettier 3.9.10, vitest 5.0.3, @vitejs/plugin-react 6.1.2, jsdom 30.1.2, @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/jest-dom 7.0.1, @types/node 24.19.2, @types/react / @types/react-dom 19.3.0 |
| 2026-10-10 | Step 2 versions: shadcn 4.21.4 (Radix base, Nova preset), ai-elements CLI 1.9.0, radix-ui 1.7.0, cn 0.4.0, class-variance-authority 0.7.1, tw-animate-css 1.4.0, next-themes 0.4.6, sonner 2.0.8, recharts 3.8.0 (pinned by shadcn `chart`), lucide-react 1.55.0, cmdk 1.1.1, ai 7.0.137, streamdown 2.7.0, shiki 4.5.0, use-stick-to-bottom 1.1.6, nanoid 6.0.2, @tanstack/react-table 9.2.8, react-hook-form 7.89.0, @hookform/resolvers 5.9.1, date-fns 4.4.0, zod 4.6.5. Fonts: Nunito (headings), Source Sans 3 (body). Section 3.4: `field` replaces `form`, which is an empty registry item in the current shadcn style |
| 2026-10-11 | Added `npm run check` self-check command for grading |
| 2026-10-11 | Weeks independent: no cross-week imports (lint rule + CLAUDE.md) |
| 2026-10-11 | Home page reduced to a placeholder; the landing page is Module 1 |
| 2026-10-11 | Added `npm run start-module` for the no-organization workflow |
| 2026-10-11 | One product built step by step: removed cross-week import rule and course:update; added db:migrate; check covers earlier modules |
| 2026-10-11 | Steps 3–7 built. Versions: @supabase/supabase-js 2.117.3, @supabase/ssr 0.12.7, supabase CLI 2.120.0, @electric-sql/pglite 0.5.8 and @electric-sql/pglite-pgvector 0.0.9 (seed test runs the migrations in-process). Approved models (gateway ids): anthropic/claude-haiku-5.5 (default), anthropic/claude-sonnet-5.5, anthropic/claude-opus-5.5. Docs MCP: next-devtools-mcp 0.4.0. Logo and favicon from `docs/copper-state-labs/assets/`; dark-mode logo recolors the wordmark to Desert Sand. Placeholders to fill in: student repo URL in the README Deploy button, instructor username in `course.config.json` |
| 2026-10-11 | Student repos are public (`start-module` no longer invites the instructor; `instructor` removed from `course.config.json`). Added the modular grader (`npm run grade`), rubric-weighted scoring shared with `npm run check`, the Vercel deployment check, `specs/module-0/rubric.md`, and a rubric/test consistency test |
| 2026-10-11 | Added `npm run grade:docker`: grading runs in a locked-down container with a read-only GitHub token, and each student's code runs as a separate user. The grader's end-to-end test no longer depends on the branch's home page |
| 2026-10-20 | Course units are called modules everywhere: `ai_calls.week` renamed to `module` (new migration), `CallInfo.week` → `module`. Removed the README Deploy button (students import their own repo at vercel.com/new). Product Bible limited to company facts; course trap list, review-dataset guidance and asset checklist removed |
| 2026-10-20 | Docs and specs reorganized: this spec moved from `specs/base/spec.md` to `docs/starter-app.md`; `specs/module-0-sample/` renamed `specs/module-0/` with the setup instructions as `instructions.md`; `docs/architecture-template.md` became `docs/architecture.md` (app overview plus a per-module template); added `docs/README.md` |
| 2026-10-20 | `start-module` can be run again after a failure: it creates the GitHub repo before adding the `origin` remote, reuses an existing `copper-mN`, and removes `origin` again if the push fails |
