// Module 4: Copper hands refunds to the Refund Desk, a second agent with its
// own instructions and tools, and refunds over $100 wait on the Refund Console
// until a supervisor approves or denies them. Mock model, so no AI key.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LanguageModelV4StreamPart as ModelStreamPart } from "@ai-sdk/provider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finalValue } from "@/lib/ai/live";
import { toolCallsOf } from "@/lib/copper/assistant/progress";
import type { RefundRecord } from "@/lib/copper/refund-requests";

let model: MockLanguageModelV4;
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => () => model,
}));

const decideRefund = vi.fn();
vi.mock("@/lib/copper/refund-actions", () => ({
  decideRefund: (...args: unknown[]) => decideRefund(...args),
  getRefundQueue: async () => [],
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

const HOME_5_DAYS = {
  item: "copper-home",
  daysSincePurchase: 5,
  reason: "changed_mind",
} as const;

beforeEach(() => {
  vi.stubEnv(
    "REFUND_REQUESTS_FILE",
    join(mkdtempSync(join(tmpdir(), "refunds-")), "requests.json"),
  );
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  decideRefund.mockReset();
});

describe("refund requests", () => {
  it("pays refunds the rules allow, and holds ones over $100 for a supervisor", async () => {
    const { createRefundRequest, decideRefundRequest, listRefundRequests } =
      await import("@/lib/copper/refund-requests");
    const { refundDecision } = await import("@/lib/copper/refunds");
    const annual = {
      item: "copper-plus-annual",
      daysSincePurchase: 10,
      reason: "changed_mind",
    } as const;
    const paid = createRefundRequest(annual, refundDecision(annual));
    const held = createRefundRequest(HOME_5_DAYS, refundDecision(HOME_5_DAYS));
    expect(paid).toMatchObject({
      id: "RF-1001",
      status: "paid",
      amountUsd: 79,
    });
    expect(held).toMatchObject({
      id: "RF-1002",
      status: "pending",
      amountUsd: 149,
    });
    expect(listRefundRequests().map((r) => r.id)).toEqual([
      "RF-1002",
      "RF-1001",
    ]);

    expect(decideRefundRequest("RF-1002", "approved").status).toBe("approved");
    expect(() => decideRefundRequest("RF-1002", "denied")).toThrow(
      /already approved/,
    );
    expect(() => decideRefundRequest("RF-1001", "approved")).toThrow(
      /already paid/,
    );
  });

  it("submit_refund lets the rules set the amount, and won't submit a denial", async () => {
    const { refundDeskTools } = await import("@/lib/copper/assistant/tools");
    const run = (input: object) =>
      refundDeskTools.submit_refund.execute!(input as never, {
        toolCallId: "t",
        messages: [],
        context: {},
      });
    expect(await run(HOME_5_DAYS)).toMatchObject({
      submitted: true,
      status: "pending",
      amountUsd: 149,
    });
    expect(await run({ ...HOME_5_DAYS, daysSincePurchase: 60 })).toMatchObject({
      submitted: false,
      outcome: "denied",
    });
  });

  it("gives each agent its own tools", async () => {
    const { copperTools, refundDeskTools } =
      await import("@/lib/copper/assistant/tools");
    expect(Object.keys(copperTools)).toContain("handoff_to_refunds");
    expect(Object.keys(copperTools)).not.toContain("submit_refund");
    expect(Object.keys(copperTools)).not.toContain("check_refund");
    expect(Object.keys(refundDeskTools).sort()).toEqual([
      "check_refund",
      "refund_status",
      "submit_refund",
    ]);
  });
});

describe("handoff to the Refund Desk", () => {
  it("Copper hands off, then the Refund Desk submits the refund and answers", async () => {
    model = modelStreaming(
      calls("handoff_to_refunds", {
        summary: "Bought Copper Home 5 days ago, changed mind, wants a refund.",
      }),
      calls("submit_refund", HOME_5_DAYS),
      says("Request RF-1001 for $149 is with a Copper Crew supervisor."),
    );
    vi.resetModules();
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "AIza-test-key");
    const { askCopper } = await import("@/lib/copper/assistant/ask");
    const result = await finalValue(
      (
        await askCopper({
          messages: [{ role: "user", content: "Refund my Copper Home?" }],
          useTools: true,
        })
      ).progress,
    );

    expect(result.status).toBe("done");
    expect(result.agent).toBe("refund-desk");
    expect(result.reply).toContain("RF-1001");
    expect(result.steps.find((s) => s.type === "handoff")).toMatchObject({
      to: "refund-desk",
      summary: expect.stringContaining("Copper Home"),
    });
    expect(toolCallsOf(result).map((t) => t.name)).toEqual([
      "handoff_to_refunds",
      "submit_refund",
    ]);
    expect(toolCallsOf(result)[1].output).toMatchObject({
      id: "RF-1001",
      status: "pending",
    });

    // Copper stopped at the handoff; the Refund Desk ran with its own
    // instructions, Copper's note, and only its own tools.
    expect(model.doStreamCalls).toHaveLength(3);
    const desk = model.doStreamCalls[1];
    expect(JSON.stringify(desk.prompt)).toContain("You are the Refund Desk");
    expect(JSON.stringify(desk.prompt)).toContain("changed mind");
    expect(desk.tools?.map((t) => t.name).sort()).toEqual([
      "check_refund",
      "refund_status",
      "submit_refund",
    ]);

    const { listRefundRequests } = await import("@/lib/copper/refund-requests");
    expect(listRefundRequests()).toHaveLength(1);
  });

  it("without a handoff, Copper answers alone", async () => {
    model = modelStreaming(says("Copper Home is $149."));
    vi.resetModules();
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "AIza-test-key");
    const { askCopper } = await import("@/lib/copper/assistant/ask");
    const result = await finalValue(
      (
        await askCopper({
          messages: [{ role: "user", content: "How much is Copper Home?" }],
          useTools: true,
        })
      ).progress,
    );
    expect(result.agent).toBeUndefined();
    expect(result.steps.some((s) => s.type === "handoff")).toBe(false);
    expect(model.doStreamCalls).toHaveLength(1);
  });
});

describe("Refund Console", () => {
  const pending: RefundRecord = {
    ...HOME_5_DAYS,
    id: "RF-1001",
    createdAt: "2026-11-19T10:00:00.000Z",
    amountUsd: 149,
    rule: "Copper Home can be returned within 30 days, for any reason.",
    source: "Terms and Conditions, Section 2.1",
    status: "pending",
  };

  it("lets a supervisor approve a refund that is waiting", async () => {
    decideRefund.mockResolvedValue([{ ...pending, status: "approved" }]);
    const { RefundQueue } = await import("@/components/copper/refund-queue");
    render(<RefundQueue initial={[pending]} />);
    expect(screen.getByText("Needs approval")).toBeVisible();
    expect(
      screen.getByText("1 refund waiting for a supervisor.", { exact: false }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Approved")).toBeVisible();
    expect(decideRefund).toHaveBeenCalledWith("RF-1001", "approved");
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("explains what to do when there are no requests", async () => {
    const { RefundQueue } = await import("@/components/copper/refund-queue");
    render(<RefundQueue initial={[]} />);
    expect(screen.getByText(/No refund requests yet/)).toBeVisible();
  });
});
