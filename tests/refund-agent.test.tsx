// Module 4: Copper hands refunds to the Refund agent, a second agent with its
// own instructions and tools. The app (code, not the model) refunds an order
// at or under the auto-refund limit; over it, the refund waits on the Refund
// Console until a person approves or rejects it. Mock model, so no AI key.
import type { LanguageModelV4StreamPart as ModelStreamPart } from "@ai-sdk/provider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finalValue } from "@/lib/ai/live";
import { toolCallsOf } from "@/lib/copper/assistant/progress";
import {
  type Desk,
  ordersWithRefunds,
  requestRefund,
} from "@/lib/copper/orders";

let model: MockLanguageModelV4;
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => () => model,
}));

type StreamPart = Parameters<
  typeof convertArrayToReadableStream<ModelStreamPart>
>[0][number];

const usage = {
  inputTokens: {
    total: 500,
    noCache: 500,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 50, text: 50, reasoning: undefined },
};

const finish = (reason: "stop" | "tool-calls"): StreamPart => ({
  type: "finish",
  finishReason: { unified: reason, raw: undefined },
  usage,
});

const says = (text: string): StreamPart[] => [
  { type: "text-start", id: "t1" },
  { type: "text-delta", id: "t1", delta: text },
  { type: "text-end", id: "t1" },
  finish("stop"),
];

// Every call uses the id "call-1", as a real model may for each agent.
const calls = (toolName: string, input: unknown): StreamPart[] => [
  { type: "tool-input-start", id: "call-1", toolName },
  { type: "tool-input-end", id: "call-1" },
  {
    type: "tool-call",
    toolCallId: "call-1",
    toolName,
    input: JSON.stringify(input),
  },
  finish("tool-calls"),
];

function modelStreaming(...steps: StreamPart[][]) {
  let step = 0;
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream(steps[step++] ?? says("")),
    }),
  });
}

const desk = (limitUsd = 50, refunds: Desk["refunds"] = []): Desk => ({
  limitUsd,
  refunds,
});

async function ask(
  request: Parameters<typeof import("@/lib/copper/assistant/ask").askCopper>[0],
) {
  vi.resetModules();
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "AIza-test-key");
  const { askCopper } = await import("@/lib/copper/assistant/ask");
  return finalValue((await askCopper(request)).progress);
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the refund rule (code, not the model)", () => {
  it("refunds at or under the limit, and holds anything over it", () => {
    expect(requestRefund("1001", desk(50))).toMatchObject({
      status: "refunded",
      amountUsd: 7.99,
      limitUsd: 50,
    });
    expect(requestRefund("#1002", desk(79)).status).toBe("refunded");
    expect(requestRefund("1004", desk(50))).toMatchObject({
      status: "needs_approval",
      amountUsd: 149,
    });
    expect(requestRefund("1001", desk(0)).status).toBe("needs_approval");
  });

  it("never decides the same order twice, and knows unknown orders", () => {
    const earlier = desk(500, [
      {
        orderId: "1004",
        item: "Copper Home",
        amountUsd: 149,
        status: "rejected",
        by: "supervisor",
      },
    ]);
    expect(requestRefund("1004", earlier)).toEqual({
      status: "rejected",
      orderId: "1004",
      item: "Copper Home",
      amountUsd: 149,
    });
    expect(requestRefund("9999", earlier)).toEqual({
      status: "not_found",
      orderId: "9999",
    });
    expect(
      ordersWithRefunds(earlier).orders.map((o) => [o.id, o.refund]),
    ).toEqual([
      ["1001", "none"],
      ["1002", "none"],
      ["1003", "none"],
      ["1004", "rejected"],
    ]);
  });
});

describe("handoff to the Refund agent", () => {
  it("Copper hands off; the Refund agent asks the app, with only its own tools", async () => {
    model = modelStreaming(
      calls("transfer_to_refund_agent", { reason: "refund order #1004" }),
      calls("request_refund", { orderId: "1004" }),
      says("A supervisor needs to approve it."),
    );
    const result = await ask({
      messages: [{ role: "user", content: "Refund order #1004" }],
      useTools: true,
      desk: desk(50),
    });
    expect(result.status).toBe("done");
    expect(result.agent).toBe("refund");
    expect(result.steps.find((s) => s.type === "handoff")).toEqual({
      type: "handoff",
      from: "copper",
      to: "refund",
    });
    expect(toolCallsOf(result).map((t) => t.name)).toEqual([
      "transfer_to_refund_agent",
      "request_refund",
    ]);
    expect(toolCallsOf(result)[1].output).toMatchObject({
      status: "needs_approval",
      amountUsd: 149,
    });
    // Copper stopped at the handoff; the Refund agent ran with its own
    // instructions and only its own tools.
    expect(model.doStreamCalls).toHaveLength(3);
    expect(model.doStreamCalls[0].tools?.map((t) => t.name)).toContain(
      "transfer_to_refund_agent",
    );
    const refund = model.doStreamCalls[1];
    expect(JSON.stringify(refund.prompt)).toContain("You are the Refund agent");
    expect(refund.tools?.map((t) => t.name).sort()).toEqual([
      "get_orders",
      "request_refund",
      "transfer_to_copper",
    ]);
  });

  it("the Refund agent keeps the conversation, and can hand it back to Copper", async () => {
    model = modelStreaming(
      calls("transfer_to_copper", { reason: "price question" }),
      says("Copper Home is $149."),
    );
    const result = await ask({
      messages: [{ role: "user", content: "How much is Copper Home?" }],
      useTools: true,
      desk: desk(50),
      agent: "refund",
    });
    expect(result.agent).toBe("copper");
    expect(result.steps.find((s) => s.type === "handoff")).toEqual({
      type: "handoff",
      from: "refund",
      to: "copper",
    });
    expect(result.reply).toBe("Copper Home is $149.");
  });

  it("off the Support page, Copper has no handoff tool", async () => {
    model = modelStreaming(says("Copper Home is $149."));
    await ask({
      messages: [{ role: "user", content: "How much is Copper Home?" }],
      useTools: true,
    });
    expect(model.doStreamCalls[0].tools?.map((t) => t.name)).not.toContain(
      "transfer_to_refund_agent",
    );
  });
});

describe("Refund Console", () => {
  it("shows the limit, an empty waiting area and the customer's orders", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    const { default: Support } = await import("@/app/support/page");
    render(<Support />);
    expect(screen.getByLabelText("Auto-refund limit")).toHaveValue(50);
    expect(
      screen.getByText(
        "Nothing is waiting. Refunds over the limit will stop here.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Maya Reyes's orders")).toBeVisible();
    const orders = screen.getAllByTestId("order");
    expect(orders).toHaveLength(4);
    expect(within(orders[3]).getByText("Copper Home")).toBeVisible();
    expect(within(orders[3]).getByText("Paid")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Auto-refund limit"), {
      target: { value: "200" },
    });
    expect(
      screen.getByText(/Refunds up to \$200 go through on their own/),
    ).toBeVisible();
  });
});
