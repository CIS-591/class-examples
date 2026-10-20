# Copper State Labs: CIS 591 course app

All semester you build one app for **Copper State Labs**, a fictional Arizona
company that makes AI-first devices. Each module adds a feature to the app.

_Fictional — for educational use._

## How the course repo works

- `main` (this page) is only the guide. The code is on the module branches.
- Each module has its own branch: `module-0`, `module-1`, and so on. A branch
  holds the starter code and that module's folder, `specs/module-N/`, with
  `instructions.md`, `spec.md`, `rubric.md` and the tests.
- **Each module is a new repo for you.** You clone that module's branch and
  make your own public `copper-mN` repo from it. Every module starts from a
  working app, so you never need to fix an earlier module to continue.

## Modules

| Module | What you build                                | Branch     | Instructions                                                                                                                                                                                    |
| ------ | --------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | Set up the app, make your own repo, deploy it | `module-0` | [Instructions](https://github.com/CIS-591/class-examples/blob/module-0/specs/module-0/instructions.md)                                                                                          |
| 1      | The Copper State Labs landing page            | `module-1` | [Instructions](https://github.com/CIS-591/class-examples/blob/module-1/specs/module-1/instructions.md) · [Spec](https://github.com/CIS-591/class-examples/blob/module-1/specs/module-1/spec.md) |

More modules are added here as they're released.

## What you need

| Tool                                     | Get it                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| GitHub account and the GitHub CLI (`gh`) | https://github.com/signup, https://cli.github.com, then run `gh auth login` |
| Node.js 24                               | https://nodejs.org (or `nvm use`)                                           |
| Git                                      | Included on Mac; https://git-scm.com on Windows                             |
| Vercel account                           | https://vercel.com/signup (sign up with GitHub)                             |
| Claude Code or Codex                     | Your main way of working on the code                                        |

Later modules also need a **Supabase** project and an **AI Gateway key**. The
module that needs them explains how to set them up.

## Start a module

Replace `N` with the module number (Module 0 is first):

```bash
git clone --branch module-N https://github.com/CIS-591/class-examples.git copper-mN
cd copper-mN
npm run start-module   # creates github.com/YOUR-USERNAME/copper-mN (public) and pushes to it
npm ci
npm run dev            # http://localhost:3000
```

Then follow `specs/module-N/instructions.md`.

If `npm run start-module` stops with an error, fix what the message says and
run it again. It picks up where it stopped.

**Deploy:** at https://vercel.com/new, import your `copper-mN` repo and click
**Deploy** without changing any settings. Every push to `main` then redeploys
the site.

**No local setup?** Once `start-module` has created your repo, you can open it
on GitHub under **Code → Codespaces**. The codespace installs everything and
starts the app for you.

## Commands

| Command                              | What it does                                                         |
| ------------------------------------ | -------------------------------------------------------------------- |
| `npm run dev`                        | Start the app at http://localhost:3000                               |
| `npm test`                           | Run the app's tests                                                  |
| `npm run check`                      | Show which of this module's criteria pass, with points               |
| `npm run lint` / `npm run typecheck` | Check code style and types                                           |
| `npm run format`                     | Format the code                                                      |
| `npm run db:migrate`                 | Apply the database migrations and seed data to your Supabase project |

`npm run check` runs the public tests. Grading uses the same criteria and may
run more tests, and also checks your live Vercel site.

## Environment variables

The app builds and runs with **none**. A page that needs a service shows a
"Set up …" card until that service is configured. Put variables in
`.env.local` (never commit it) and in your Vercel project settings.

| Variable                               | Used for                  | Where to find it                                                                   |
| -------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| `AI_GATEWAY_API_KEY`                   | All AI calls              | Vercel dashboard > AI Gateway > API Keys. Set a spending limit                     |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase database         | Supabase dashboard > Project Settings > API                                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase database         | Supabase dashboard > Project Settings > API Keys (publishable key)                 |
| `SUPABASE_DB_URL`                      | `npm run db:migrate` only | Supabase dashboard > Connect > Direct connection (includes your database password) |

## Working with AI agents

The module branches come set up for Claude Code and Codex. `CLAUDE.md` /
`AGENTS.md` tell the agent to show a plan and wait for your approval, add tests
to every change and run them, and never read `.env` files.

The first time you start Claude Code in a module, approve its three MCP
servers: shadcn, next-devtools and supabase (read-only). Codex doesn't read
`.mcp.json`, so add them to `~/.codex/config.toml`:

```toml
[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@4.21.4", "mcp"]

[mcp_servers.next-devtools]
command = "npx"
args = ["-y", "next-devtools-mcp@0.4.0"]

[mcp_servers.supabase]
url = "https://mcp.supabase.com/mcp?read_only=true"
```

## Rules

- **Never commit `.env` files or paste keys into code.** Your repos are public,
  and a leaked AI Gateway key spends real money.
- **Don't edit `specs/*/tests`, `specs/*/evals` or `rubric.md`.** Grading uses
  the instructor's copy, so any changes you make there have no effect.
- **Don't "fix" the Product Bible**
  (`docs/copper-state-labs/product-bible.md`). Some of its facts conflict on
  purpose.
- **Everything about Copper State Labs is fictional.** Don't use real company
  names, logos or products.

## Where things are (on a module branch)

| Path                                      | What it is                                                |
| ----------------------------------------- | --------------------------------------------------------- |
| `specs/module-N/`                         | This module's instructions, spec, rubric and tests        |
| `docs/copper-state-labs/product-bible.md` | Facts about the company: products, prices, policies, data |
| `docs/architecture.md`                    | How the app fits together                                 |
| `app/`, `components/`, `lib/`             | The app's code                                            |
| `supabase/migrations/`                    | Database tables                                           |

## Getting help

Each module's `instructions.md` has a troubleshooting table. If you're stuck for
more than 20 minutes, post in the course forum with the command you ran and the
full error, or come to office hours.
