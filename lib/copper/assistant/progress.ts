// What Ask Copper is doing, step by step, as it streams in: Gemini's thinking
// summaries, each tool call (with what went in and what came out), and the
// reply. The panel draws this as it changes.

/** Who is answering: Copper, or the Refund Desk after a handoff (Module 4). */
export type Agent = "copper" | "refund-desk";

export const AGENT_NAMES: Record<Agent, string> = {
  copper: "Copper",
  "refund-desk": "Refund Desk",
};

export type ThinkingStep = { type: "thinking"; text: string; agent?: Agent };

export type ToolStep = {
  type: "tool";
  id: string;
  /** Which agent called it (Copper unless set). */
  agent?: Agent;
  name: string;
  /** "calling" until the tool's result comes back. */
  state: "calling" | "done" | "error";
  input?: unknown;
  output?: unknown;
};

/** Copper passed the conversation to the Refund Desk, with a note. */
export type HandoffStep = { type: "handoff"; to: Agent; summary: string };

export type Step = ThinkingStep | ToolStep | HandoffStep;

export type Progress = {
  steps: Step[];
  reply: string;
  status: "working" | "done" | "error";
  /** Who wrote the reply. Copper unless set. */
  agent?: Agent;
};

/** Every tool call in an answer, in order. */
export function toolCallsOf(progress: Progress) {
  return progress.steps
    .filter((step): step is ToolStep => step.type === "tool")
    .map(({ name, input, output }) => ({ name, input, output }));
}

/**
 * The tools Copper can use, and what each one does in plain English. The chat
 * panel lists these, so it lives here (and not in tools.ts, which reads the
 * database and can't be imported by a client component).
 */
export const COPPER_TOOL_LABELS: Record<string, string> = {
  get_products: "Listing the products",
  get_prices: "Looking up prices",
  calculate_cost: "Working out the cost",
  check_availability: "Checking stock",
  search_docs: "Searching the documents",
  handoff_to_refunds: "Handing off to the Refund Desk",
};

/** The Refund Desk's tools (Module 4). */
export const REFUND_DESK_TOOL_LABELS: Record<string, string> = {
  check_refund: "Checking the refund rules",
  submit_refund: "Submitting the refund",
  refund_status: "Looking up the refund",
};

export const TOOL_LABELS: Record<string, string> = {
  ...COPPER_TOOL_LABELS,
  ...REFUND_DESK_TOOL_LABELS,
};
