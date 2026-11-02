"use server";

// The server action the Ask Copper chat calls. It streams the conversation to
// the model through callStream (lib/ai/call.ts), with or without the tools,
// and sends back each step as it happens, so the panel can show Copper
// thinking and using its tools.
import { stepCountIs } from "ai";
import { callStream, THOUGHT_SUMMARIES } from "@/lib/ai/call";
import { createLive, type Live } from "@/lib/ai/live";
import { COPPER_INSTRUCTIONS } from "@/lib/copper/assistant/instructions";
import type { Progress, ToolStep } from "@/lib/copper/assistant/progress";
import { copperTools } from "@/lib/copper/assistant/tools";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AskCopperRequest = {
  messages: ChatMessage[];
  useTools: boolean;
};

export type AskCopperResult = { progress: Live<Progress> };

/** At most this many model steps (tool calls plus the reply) per question. */
const MAX_STEPS = 5;

const SORRY = "Sorry, something went wrong on my end. Please try again.";

export async function askCopper({
  messages,
  useTools,
}: AskCopperRequest): Promise<AskCopperResult> {
  const { live, update, done } = createLive<Progress>();
  const progress: Progress = { steps: [], reply: "", status: "working" };
  // A fresh copy each time, so earlier updates never change underneath the
  // panel.
  const snapshot = (): Progress => ({
    ...progress,
    steps: progress.steps.map((step) => ({ ...step })),
  });
  const toolStep = (id: string) =>
    progress.steps.find(
      (step): step is ToolStep => step.type === "tool" && step.id === id,
    );

  // Without tools, send no instructions either: "always use your tools" with
  // no tools makes the model answer with nothing.
  const result = callStream(
    { module: 2, feature: "ask-copper" },
    {
      messages,
      providerOptions: THOUGHT_SUMMARIES,
      ...(useTools && {
        instructions: COPPER_INSTRUCTIONS,
        tools: copperTools,
        stopWhen: stepCountIs(MAX_STEPS),
      }),
    },
  );

  // Read the stream in the background, so the panel gets the first update now.
  void (async () => {
    try {
      for await (const part of result.fullStream) {
        switch (part.type) {
          case "reasoning-delta": {
            const last = progress.steps.at(-1);
            if (last?.type === "thinking") last.text += part.text;
            else progress.steps.push({ type: "thinking", text: part.text });
            break;
          }
          case "tool-input-start":
            progress.steps.push({
              type: "tool",
              id: part.id,
              name: part.toolName,
              state: "calling",
            });
            break;
          case "tool-call": {
            const step = toolStep(part.toolCallId);
            if (step) step.input = part.input;
            else
              progress.steps.push({
                type: "tool",
                id: part.toolCallId,
                name: part.toolName,
                state: "calling",
                input: part.input,
              });
            break;
          }
          case "tool-result": {
            const step = toolStep(part.toolCallId);
            if (step)
              Object.assign(step, { output: part.output, state: "done" });
            break;
          }
          case "tool-error": {
            const step = toolStep(part.toolCallId);
            const message =
              part.error instanceof Error
                ? part.error.message
                : String(part.error);
            if (step) Object.assign(step, { output: message, state: "error" });
            break;
          }
          case "text-delta":
            progress.reply += part.text;
            break;
          case "error":
            throw part.error;
          default:
            continue;
        }
        update(snapshot());
      }
      progress.status = "done";
      if (!progress.reply.trim()) progress.reply = SORRY;
    } catch {
      progress.status = "error";
      if (!progress.reply.trim()) progress.reply = SORRY;
    }
    done(snapshot());
  })();

  return { progress: live };
}
