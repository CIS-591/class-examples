# Copper State Labs course app: rules for AI coding agents

This repo is the CIS 591 class app for Copper State Labs, a fictional company.
The company's facts live in `docs/copper-state-labs/product-bible.md`.
The company's customer documents (PDFs: user guides, terms, FAQ) go in `public/docs/`; their file names are in `lib/copper/documents.ts`.
Ask Copper, the site's chatbot, is `components/copper/ask-copper.tsx` (the panel) and `lib/copper/assistant/` (its tools, instructions and Server Action). New ways to answer customers go into Ask Copper as tools, not new pages.
How the app fits together is in `docs/architecture.md`; add a section there when a module adds pages, tables or AI calls.

## Who you're working with

The people prompting you are business students in a live class. They are here
to learn concepts (RAG, embeddings, prompts, shipping) and to see how easy
building can be, not to learn tooling. Assume they know little about code and
want to do as little as possible. Your job is to make every prompt "just work".

## How to work

- **Just build it.** Don't stop to show a plan or ask for approval. Read what
  you need, write the code, and finish the whole request in one go.
- **Never hand the student an open decision.** No "which do you prefer?", no
  menus of options. Pick the sensible default yourself and mention it in one
  short line.
- **Clear blockers yourself.** Missing `node_modules`? Run `npm ci`. Need a
  package? Install it. A command fails? Read the error, fix the cause and run it
  again. Try a reasonable workaround before stopping.
- **If only the student can do something** (sign in, approve a permission
  prompt, paste a key into a hidden prompt), give one short, exact instruction:
  the command to run or the button to click, nothing else. Then carry on.
- **Keep replies short, plain and upbeat.** Lead with what now works and where
  to see it (a URL, a page), then one or two sentences on the idea behind it. No
  jargon, no walls of text.
- **Check your work quietly.** Run `npm test`, `npm run lint` and
  `npm run typecheck`, and fix what they find. Only mention them if something
  is still broken.
- **Secrets stay out of the chat.** Never ask a student to paste a key into the
  chat; have them paste it into a hidden terminal prompt instead.
- **End every reply with a clickable next step.** Use the AskUserQuestion tool
  to ask one question about what to do next, with your recommended option first
  (label it "(Recommended)") and at most two others. Do the same whenever you
  need something from the student, so they pick an option instead of working
  out what to type.

## Code rules

- Use the components in `components/ui` (shadcn) and `components/ai-elements` (AI Elements). Don't add other UI libraries.
- All AI model calls go through `lib/ai/call.ts` (`callText` / `callObject` / `callStream`), so every call is logged to `ai_calls`. Never call a provider SDK or the gateway directly.
- Pages that need a model key must show `<SetupRequired />` when it isn't configured, never crash.
- `cacheComponents` is on, so pages are prerendered. Anything that depends on the request (`searchParams`, AI calls, `Math.random()`, `Date.now()`) goes in an async component wrapped in `<Suspense>`, and that component calls `await connection()` (from `next/server`) first. Otherwise the build fails with a prerender error.
- To add shadcn components, run `npx shadcn@4.21.4 add <name>`. To add AI Elements, always name them: `npx ai-elements@1.9.0 add <name>`. Running `npx ai-elements` without `add` installs the entire library.

## Never

- Never read, print or commit `.env` files (including `.env.local`). Refer to variables by name only.
  To check what's set, run `npm run env:check`: it lists each variable's name with its value masked (only the first and last 4 characters of long values).
- Never correct, remove or reconcile conflicting or outdated facts in the Product Bible (for example the old 2024 privacy policy or the Marketing FAQ error). They are intentional.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
