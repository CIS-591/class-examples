// @vitest-environment node
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  AiNotConfiguredError,
  callObject,
  callText,
  isAiConfigured,
} from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import { costUsd, PRICING } from "@/lib/ai/pricing";

// Google hands back whatever mock model the test sets.
let model: MockLanguageModelV4;
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => () => model,
}));

function replyWith(text: string, input = 1000, output = 200) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: input,
          noCache: input,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: output, text: output, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

/** Captures the rows printed as "[ai_calls] {...}". */
function captureLog() {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  return () =>
    info.mock.calls
      .filter(([tag]) => tag === "[ai_calls]")
      .map(([, row]) => JSON.parse(row as string));
}

beforeEach(() => {
  // An AI Studio key, from aistudio.google.com.
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "AIza-test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("pricing", () => {
  it("has a price for every approved model", () => {
    for (const { id } of MODELS) expect(PRICING[id]).toBeDefined();
  });

  it("computes cost from tokens and price per million", () => {
    // Gemini 2.5 Flash: 1,000 x $0.3/M + 200 x $2.5/M = $0.0008
    expect(costUsd("google/gemini-2.5-flash", 1000, 200)).toBeCloseTo(
      0.0008,
      9,
    );
  });
});

describe("lib/ai/call.ts", () => {
  it("returns text and logs one row with tokens, cost and latency", async () => {
    const rows = captureLog();
    model = replyWith("Hello from Copper");
    const result = await callText(
      { module: 2, feature: "review-radar", model: "google/gemini-2.5-flash" },
      { prompt: "Say hello" },
    );
    expect(result.text).toBe("Hello from Copper");
    const logged = rows();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      module: 2,
      feature: "review-radar",
      model: "google/gemini-2.5-flash",
      input_tokens: 1000,
      output_tokens: 200,
      ok: true,
    });
    expect(logged[0].cost_usd).toBeCloseTo(0.0008, 9);
    expect(logged[0].latency_ms).toBeGreaterThanOrEqual(0);
    expect(new Date(logged[0].created_at).toString()).not.toBe("Invalid Date");
  });

  it("returns a typed object for structured calls", async () => {
    captureLog();
    model = replyWith('{"category":"wake word","flag":false}');
    const result = await callObject(
      { module: 2, feature: "classify-review" },
      {
        prompt: "Classify this review",
        schema: z.object({ category: z.string(), flag: z.boolean() }),
      },
    );
    expect(result.output).toEqual({ category: "wake word", flag: false });
    // Compile-time check (npm run typecheck): output keeps the schema's type.
    const flag: boolean = result.output.flag;
    expect(flag).toBe(false);
    expect(result.usage).toBeDefined();
  });

  it("uses Gemini 2.5 Flash when no model is given", async () => {
    const rows = captureLog();
    model = replyWith("ok");
    await callText({ module: 1, feature: "test" }, { prompt: "hi" });
    expect(rows()[0].model).toBe("google/gemini-2.5-flash");
  });

  it("logs failed calls with ok: false and re-throws the error", async () => {
    const rows = captureLog();
    model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("google down");
      },
    });
    await expect(
      callText({ module: 1, feature: "test" }, { prompt: "hi", maxRetries: 0 }),
    ).rejects.toThrow("google down");
    expect(rows()[0]).toMatchObject({
      ok: false,
      input_tokens: null,
      cost_usd: null,
    });
  });

  it("asks for the Google key when it isn't set", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    expect(isAiConfigured()).toBe(false);
    await expect(
      callText({ module: 1, feature: "test" }, { prompt: "hi" }),
    ).rejects.toBeInstanceOf(AiNotConfiguredError);
  });
});
