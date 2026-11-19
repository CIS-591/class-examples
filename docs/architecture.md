# Architecture

How the Copper State Labs app fits together. Each module adds a section at the
end (see [Adding a module](#adding-a-module)) when it changes how the app
works: new pages, tables or AI calls.

_Fictional — for educational use._

## The starter app (Module 0)

A Next.js app that builds, runs and deploys with **no environment variables**.
A Google AI Studio key is optional until a module needs one.

| Piece | Where | What it does |
|---|---|---|
| Pages | `app/` | `layout.tsx` sets the fonts and theme; `page.tsx` is the placeholder home page |
| Brand components | `components/copper/` | `Logo`, `SiteHeader`, `SiteFooter`, `ModeToggle` |
| UI kit | `components/ui/` (shadcn), `components/ai-elements/` (AI Elements) | The only UI libraries the app uses |
| Setup card | `components/setup-required.tsx` | `<SetupRequired service="ai" />`, shown instead of a page whose service isn't configured |
| Company catalog | `lib/copper/catalog.ts`, `lib/copper/data/catalog.json` | Product, plan and privacy facts from the Product Bible (Sections 3, 4, 8 and 10). Pages read prices and plan details from here instead of typing them (added in the Module 1 starter) |
| AI wrapper | `lib/ai/call.ts` | `callText` and `callObject`: every model call goes through these and is logged to the terminal |
| Models and prices | `lib/ai/models.ts`, `lib/ai/pricing.ts` | The approved Gemini models and their token prices |

## Data flow

1. A user opens a page in `app/`.
2. Server code checks what's configured (`isAiConfigured()`). If the key is
   missing, the page renders `<SetupRequired />` instead of crashing.
3. Data comes from files under `lib/copper/data/`.
4. AI requests go through `callText` / `callObject` in `lib/ai/call.ts`, which
   calls Google and then prints one `[ai_calls]` line: `module`, `feature`,
   `model`, tokens, `cost_usd`, `latency_ms`, `ok`.

```ts
const { text } = await callText(
  { module: 2, feature: "ask-copper" },
  { prompt },
);
```

## Two kinds of "AI tiers"

Don't mix these up:

- **Copper State Labs' product tiers** (On-device, Raw Ore, Refined, the
  Copper Cloud) are part of the fictional company. They are facts in the
  [Product Bible](copper-state-labs/product-bible.md) and rows in the `ai_tiers`
  table.
- **The models this app calls** are real Claude models listed in
  `lib/ai/models.ts`. Their cost is logged in `ai_calls`.

## Decisions

- **No environment variables required.** Every service is optional, so a fresh
  clone builds and deploys before any accounts are set up.
- **One AI wrapper.** Routing every call through `lib/ai/call.ts` gives one
  place to log cost and latency per module and feature.
- **No authentication or row-level security yet.** They arrive in a later
  module.

## Adding a module

When a module changes how the app fits together, add a section here:

```md
## Module N: <feature name>

**Summary:** one or two sentences: what this adds and why.

| Piece | Where | What it does |
|---|---|---|
| Page / route | `app/...` | |
| Components | `components/...` | |
| Data | `lib/copper/data/...` | Data files added |
| AI calls | `lib/ai/call.ts` (module, feature) | Model, prompt purpose, expected cost per call |

**Data flow:** user action → page → server code → database / model → response.

**Decisions and trade-offs:** what you chose, the alternatives, and why.

**Risks and open questions:** cost, privacy, accuracy or safety risks, and how
you handle them.
```

## Module 3 starter: Ask Copper

**Summary:** Ask Copper, the Module 2 shopping chatbot, finished: a floating
chat panel that answers prices, totals and stock with four tools and shows
each step. Module 3 teaches it to answer from the customer documents.

| Piece | Where | What it does |
|---|---|---|
| Component | `components/copper/ask-copper.tsx` | The launcher and chat panel, mounted from `app/page.tsx` and opened by the header's `#ask` link. Draws each answer as stations: the tools on offer, thinking, each tool call, then the reply |
| Server Action | `lib/copper/assistant/ask.ts` | `askCopper()`: streams the conversation with `callStream`, up to 5 steps, and sends each step back as a live `Progress` |
| Tools | `lib/copper/assistant/tools.ts` | `copperTools`: `get_products`, `get_prices`, `calculate_cost`, `check_availability` |
| Instructions | `lib/copper/assistant/instructions.ts` | `COPPER_INSTRUCTIONS`. Copper says it can't help yet with warranty, setup, troubleshooting or privacy |
| Data | `lib/copper/inventory.ts`, `lib/copper/documents.ts` | Stock from `lib/copper/data/inventory.json`; `DOCUMENTS`: the four customer documents and their PDF paths under `public/docs/`. The PDFs are added in class |
| AI calls | `{ module: 2, feature: "ask-copper" }` | One streamed call per question |

## Module 3: Document passages and embeddings

**Summary:** The four customer PDFs in `public/docs/` are split into passages
of a few sentences and embedded with Gemini, so Ask Copper can find the
passages that answer a question and cite their page.

| Piece | Where | What it does |
|---|---|---|
| Build script | `scripts/embed-docs.mjs` (`npm run embed-docs`) | Reads each PDF in `DOCUMENTS` page by page (with `unpdf`), splits pages with `splitPage()`, embeds every passage and writes the JSON. Re-run it when a PDF changes |
| Splitter | `lib/copper/split-passages.ts` | `splitPage()`: drops the footer lines, then groups sentences three at a time (at most ~600 characters) |
| Data | `lib/copper/data/passages.json`, `lib/copper/passages.ts` | `PASSAGES`: `documentId`, `title`, `page`, `text` (starts with the document title) and `embedding`. Importing it loads every passage into memory once per server |
| Tool | `lib/copper/assistant/tools.ts` | `search_docs`: embeds the question, ranks every passage by cosine similarity and returns the 5 closest with title, page, a `/docs/<file>.pdf#page=N` link and a score. The tool card lists them with links; the instructions tell Copper to use it for setup, troubleshooting, warranty and policy questions and to cite the page |
| Citations | `lib/copper/assistant/citations.ts`, `lib/copper/assistant/instructions.ts` | Copper answers document questions only from `search_docs`, ends every sentence with `[Title, p. N]`, and says "I couldn't find that in our support docs" otherwise. `splitCitations()` lets the panel link each citation to that PDF page; unknown titles stay plain text |
| AI calls | `callEmbedMany` in `lib/ai/call.ts`, `{ module: 3, feature: "embed-docs" }` | `gemini-embedding-2` at 768 dimensions. One call per run of the script, plus one `{ module: 3, feature: "search-docs" }` call per search. Google doesn't report embedding tokens, so the log's tokens and cost are null |

**Data flow:** PDF → pages → passages → Gemini embeddings → `passages.json` →
`PASSAGES` in memory. Question → `search_docs` → question embedding → 5
closest passages → Copper answers from them and cites the page.

**Decisions and trade-offs:** A JSON file in memory instead of a vector
database: about 120 passages is under 1 MB, so searching all of them is
instant and needs no new service. 768 dimensions instead of 3072 keeps the
file small with little loss in accuracy. The title goes at the start of each
passage so similar passages from different documents (Copper Home vs. Copper
Notes) embed differently.

**Risks and open questions:** Questions must be embedded with the same model
and dimensions (`EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`) or the search
returns nonsense. Tables lose their columns when turned into text. Embeddings match meaning
better than exact strings, so an error code like C-47 can rank below other
error-code passages (it was third in testing); keyword search alongside would fix that.

## Module 4: Refund Desk agent, handoff and approvals

**Summary:** Ask Copper hands refund questions to a second agent, the Refund
Desk, which has its own instructions and tools. The refund rules are plain
code, so the model never decides a refund or its amount. Refunds over $100
wait on the Refund Console (`/support`) until a Copper Crew supervisor
approves or denies them: a person in the loop.

| Piece | Where | What it does |
|---|---|---|
| Handoff | `lib/copper/assistant/tools.ts` (`handoff_to_refunds`), `ask.ts` | Copper's tool. Copper stops at the handoff (`hasToolCall`); `askCopper` then streams the Refund Desk on the same conversation, with Copper's one-sentence note added to its instructions |
| Refund Desk | `lib/copper/assistant/instructions.ts` (`REFUND_DESK_INSTRUCTIONS`), `tools.ts` (`refundDeskTools`) | `check_refund` (the rules), `submit_refund` (records a refund the rules allow; the rules set the amount), `refund_status` (looks up RF-1001 and so on). Copper can't use these |
| Refund rules | `lib/copper/refunds.ts`, `tests/refunds.test.ts` | `refundDecision()`: returns (30 days), warranty (2 years Home, 1 year Notes, no heat damage), Copper Plus (annual within 14 days, no partial months), outage refunds to a supervisor. Over `APPROVAL_LIMIT_USD` ($100) is `needs_approval` |
| Refund requests | `lib/copper/refund-requests.ts` | A JSON file, `.data/refund-requests.json` (not in git; `REFUND_REQUESTS_FILE` moves it). `refund` outcomes are `paid` at once; `needs_approval` ones are `pending` until a supervisor sets `approved` or `denied` |
| Refund Console | `app/support/page.tsx`, `components/copper/refund-queue.tsx`, `lib/copper/refund-actions.ts` | The request table with Approve and Deny on pending rows (server actions). The chat fires `copper:refunds-changed` after a `submit_refund`, so the table reloads on its own |
| Chat panel | `components/copper/ask-copper.tsx` | Shows the handoff as its own station, with Copper's note and the Refund Desk's tools; each step and the reply are labelled with the agent that made them |
| AI calls | `{ module: 2, feature: "ask-copper" }`, `{ module: 4, feature: "refund-desk" }` | One Copper call, plus one Refund Desk call after a handoff |

**Data flow:** question → Copper → `handoff_to_refunds` → Refund Desk →
`check_refund` → `submit_refund` → request in `.data/refund-requests.json` →
Refund Console row → supervisor Approve or Deny → `refund_status` tells the
customer.

**Decisions and trade-offs:** A second agent keeps refund instructions and
tools away from shopping, so Copper can't promise money and the Refund Desk
can't wander into sales. A handoff (the Refund Desk answers) instead of an
agent-as-a-tool (Copper relays its answer) keeps one voice per reply and
shows students who decided. Each new turn starts at Copper, which hands off
again, so the client keeps no agent state; the cost is one extra short Copper
call per refund turn. Requests live in a local JSON file, not a database:
no setup for students, and they survive a restart.

**Risks and open questions:** Copper may answer a refund question itself
instead of handing off; its instructions forbid it, and Module 5's evals
check it. The JSON file isn't safe for many users at once or on Vercel's
read-only file system: a real deployment needs a database table.

## Module 5 starter

**Summary:** Module 4 as finished. Module 5 makes Ask Copper safe to ship: TDD
for one deterministic component, a golden-set evaluation with an AI judge, and
production monitoring, all with Langfuse. The eval runs in GitHub Actions on
every pull request, and `main` is protected so a failing eval blocks the merge.
