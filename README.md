# Copper State Labs: CIS 591 course app

The starter app for CIS 591. Copper State Labs is a fictional Arizona company
(see the [Product Bible](docs/copper-state-labs/product-bible.md)); each module
adds a feature to this one app.

This is the Module 3 starting point: the Copper site with Ask Copper, the
shopping chatbot from Module 2. In class we teach Ask Copper to answer from
the company's PDFs, with the page each answer came from. The
[`docs/`](docs/README.md) folder explains the company and how the app fits
together.

_Fictional — for educational use._

The app builds and runs with **no environment variables**. Pages that need a
model key show a "Set up …" card until you add one.

## Local setup

1. Install [Node 24](https://nodejs.org) (or run `nvm use`) and the [GitHub CLI](https://cli.github.com).
2. Clone your module branch, then run `npm run start-module` once to create your own public `copper-mN` repo.
3. Run `npm ci`.
4. Optional: copy the variables below into a new `.env.local` file.
5. Run `npm run dev` and open http://localhost:3000.

Or open the repo in **GitHub Codespaces**: it installs everything and starts the dev server for you.

## Environment variables

There is one, and it's optional until a module needs it. Put it in `.env.local` (never commit it) and in your Vercel project settings.

| Variable                       | Used for                        | Where to find it                                                              |
| ------------------------------ | ------------------------------- | ----------------------------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | All AI calls (`lib/ai/call.ts`) | [Google AI Studio](https://aistudio.google.com) > Get API key (free, no card) |

## Commands

| Command                              | What it does                                      |
| ------------------------------------ | ------------------------------------------------- |
| `npm run dev`                        | Start the dev server                              |
| `npm test`                           | Run the app's tests                               |
| `npm run lint` / `npm run typecheck` | Check code style and types                        |
| `npm run format`                     | Format the code with Prettier                     |
| `npm run start-module`               | One-time setup after cloning a module branch      |
| `npm run env:check`                  | List the variables in `.env.local`, values masked |

## AI coding agents

`CLAUDE.md` / `AGENTS.md` hold the rules for Claude Code and Codex. `.mcp.json`
gives Claude Code two MCP servers: shadcn and Next.js docs (`next-devtools`).

**Codex** doesn't read `.mcp.json`. Add the same servers to `~/.codex/config.toml`:

```toml
[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@4.21.4", "mcp"]

[mcp_servers.next-devtools]
command = "npx"
args = ["-y", "next-devtools-mcp@0.4.0"]
```
