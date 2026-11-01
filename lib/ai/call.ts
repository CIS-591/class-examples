import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output, streamText } from "ai";
import type { z } from "zod";
import { defaultModel, MODELS, type ModelId } from "@/lib/ai/models";
import { costUsd } from "@/lib/ai/pricing";

// Every model call in the app goes through this file, so each one is logged
// with its tokens, cost and how long it took. The log goes to the terminal
// running the app, as a line starting "[ai_calls]".

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "Set up AI to use this feature: add GOOGLE_GENERATIVE_AI_API_KEY to .env.local.",
    );
    this.name = "AiNotConfiguredError";
  }
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

/** Which module and feature made the call, for the ai_calls log. */
export type CallInfo = { module: number; feature: string; model?: ModelId };

// Omit that keeps generateText's "prompt or messages" union intact.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
type TextOptions = DistributiveOmit<
  Parameters<typeof generateText>[0],
  "model" | "output"
>;

export type AiCallRow = {
  module: number;
  feature: string;
  model: ModelId;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number;
  ok: boolean;
  created_at: string;
};

function languageModel(model: ModelId) {
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!googleKey) throw new AiNotConfiguredError();
  const entry = MODELS.find((m) => m.id === model);
  const id =
    entry && "googleId" in entry
      ? entry.googleId
      : model.slice("google/".length);
  return createGoogleGenerativeAI({ apiKey: googleKey })(id);
}

/** Prints one line per model call, so the cost and time are visible. */
async function logCall(row: AiCallRow): Promise<void> {
  console.info("[ai_calls]", JSON.stringify(row));
}

type Usage = { inputTokens?: number; outputTokens?: number };

/** Builds the ai_calls row for a call that started at `started`. */
function rowFor(info: CallInfo, model: ModelId, started: number) {
  return (ok: boolean, usage?: Usage): AiCallRow => {
    const input = usage?.inputTokens ?? null;
    const output = usage?.outputTokens ?? null;
    return {
      module: info.module,
      feature: info.feature,
      model,
      input_tokens: input,
      output_tokens: output,
      cost_usd:
        input !== null && output !== null
          ? costUsd(model, input, output)
          : null,
      latency_ms: Math.round(performance.now() - started),
      ok,
      created_at: new Date().toISOString(),
    };
  };
}

async function tracked<T extends { usage: Usage }>(
  info: CallInfo,
  run: (model: ModelId) => Promise<T>,
): Promise<T> {
  const model = info.model ?? defaultModel();
  const row = rowFor(info, model, performance.now());
  try {
    const result = await run(model);
    await logCall(row(true, result.usage));
    return result;
  } catch (error) {
    if (!(error instanceof AiNotConfiguredError)) await logCall(row(false));
    throw error;
  }
}

/** Generates text. Example: callText({ module: 3, feature: "support-answer" }, { prompt }) */
export async function callText(info: CallInfo, options: TextOptions) {
  return tracked(info, (model) =>
    generateText({ ...options, model: languageModel(model) }),
  );
}

/** Generates an object that matches a zod schema; read it from `result.output`. */
export async function callObject<Schema extends z.ZodType>(
  info: CallInfo,
  options: TextOptions & { schema: Schema },
) {
  const { schema, ...rest } = options;
  const result = await tracked(info, (model) =>
    generateText({
      ...rest,
      model: languageModel(model),
      output: Output.object({ schema }),
    }),
  );
  // Spreading `rest` loses generateText's output type; Output.object has
  // already validated it against `schema`, so restore the type here.
  return result as typeof result & { output: z.infer<Schema> };
}

type StreamOptions = DistributiveOmit<
  Parameters<typeof streamText>[0],
  "model" | "output" | "onFinish" | "onError"
>;

/**
 * Streams a reply: read `result.fullStream` to see each step as it happens
 * (thinking, tool calls, tool results, text). Logged to ai_calls when it ends.
 * Example: callStream({ module: 2, feature: "ask-copper" }, { messages })
 */
export function callStream(info: CallInfo, options: StreamOptions) {
  const model = info.model ?? defaultModel();
  const row = rowFor(info, model, performance.now());
  return streamText({
    ...options,
    model: languageModel(model),
    onFinish: ({ totalUsage }) => logCall(row(true, totalUsage)),
    onError: () => logCall(row(false)),
  });
}

// Asking for some thinking (rather than letting the model decide) is what
// makes Gemini write a summary even for an easy question.
const THINKING = { includeThoughts: true, thinkingBudget: 1024 };

/**
 * Asks Gemini to include a summary of its thinking in the stream (as
 * reasoning parts). Other models ignore it. Pass as `providerOptions`.
 */
export const THOUGHT_SUMMARIES = {
  google: { thinkingConfig: THINKING },
};
