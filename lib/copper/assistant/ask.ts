"use server";

// The server action the Ask Copper chat calls. It streams the conversation to
// the model through callStream (lib/ai/call.ts), with or without the tools,
// and sends back each step as it happens, so the panel can show Copper
// thinking and using its tools.
// Module 4: when Copper calls handoff_to_refunds, Copper stops and the Refund
// Desk (a second agent, with its own instructions and tools) answers the same
// conversation.
import { hasToolCall, stepCountIs } from "ai";
import { callStream, THOUGHT_SUMMARIES } from "@/lib/ai/call";
import { createLive, type Live } from "@/lib/ai/live";
import {
  COPPER_INSTRUCTIONS,
  REFUND_DESK_INSTRUCTIONS,
} from "@/lib/copper/assistant/instructions";
import type {
  Agent,
  Progress,
  ToolStep,
} from "@/lib/copper/assistant/progress";
import { copperTools, refundDeskTools } from "@/lib/copper/assistant/tools";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AskCopperRequest = {
  messages: ChatMessage[];
  useTools: boolean;
};

export type AskCopperResult = { progress: Live<Progress> };

/** At most this many model steps (tool calls plus the reply) per agent. */
const MAX_STEPS = 5;

const SORRY = "Sorry, something went wrong on my end. Please try again.";

type Stream = ReturnType<typeof callStream>;

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
  // Tool call ids are per agent, so each agent's are kept apart.
  const toolStep = (agent: Agent, id: string) =>
    progress.steps.find(
      (step): step is ToolStep =>
        step.type === "tool" && step.id === `${agent}:${id}`,
    );

  /** Reads one agent's stream into progress. Returns the handoff note, if any. */
  async function follow(agent: Agent, result: Stream) {
    let handoff: string | undefined;
    for await (const part of result.fullStream) {
      switch (part.type) {
        case "reasoning-delta": {
          const last = progress.steps.at(-1);
          if (last?.type === "thinking" && last.agent === agent)
            last.text += part.text;
          else
            progress.steps.push({ type: "thinking", text: part.text, agent });
          break;
        }
        case "tool-input-start":
          progress.steps.push({
            type: "tool",
            id: `${agent}:${part.id}`,
            agent,
            name: part.toolName,
            state: "calling",
          });
          break;
        case "tool-call": {
          const step = toolStep(agent, part.toolCallId);
          if (step) step.input = part.input;
          else
            progress.steps.push({
              type: "tool",
              id: `${agent}:${part.toolCallId}`,
              agent,
              name: part.toolName,
              state: "calling",
              input: part.input,
            });
          break;
        }
        case "tool-result": {
          const step = toolStep(agent, part.toolCallId);
          if (step) Object.assign(step, { output: part.output, state: "done" });
          if (part.toolName === "handoff_to_refunds")
            handoff = (part.output as { summary: string }).summary;
          break;
        }
        case "tool-error": {
          const step = toolStep(agent, part.toolCallId);
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
    return handoff;
  }

  // Without tools, send no instructions either: "always use your tools" with
  // no tools makes the model answer with nothing.
  const copper = callStream(
    { module: 2, feature: "ask-copper" },
    {
      messages,
      providerOptions: THOUGHT_SUMMARIES,
      ...(useTools && {
        instructions: COPPER_INSTRUCTIONS,
        tools: copperTools,
        // A handoff ends Copper's turn: the Refund Desk answers.
        stopWhen: [stepCountIs(MAX_STEPS), hasToolCall("handoff_to_refunds")],
      }),
    },
  );

  // Read the stream in the background, so the panel gets the first update now.
  void (async () => {
    try {
      const handoff = await follow("copper", copper);
      if (handoff !== undefined) {
        progress.steps.push({
          type: "handoff",
          to: "refund-desk",
          summary: handoff,
        });
        progress.agent = "refund-desk";
        progress.reply = "";
        update(snapshot());
        const desk = callStream(
          { module: 4, feature: "refund-desk" },
          {
            messages,
            providerOptions: THOUGHT_SUMMARIES,
            instructions: `${REFUND_DESK_INSTRUCTIONS}\n\nCopper's handoff note: ${handoff}`,
            tools: refundDeskTools,
            stopWhen: stepCountIs(MAX_STEPS),
          },
        );
        await follow("refund-desk", desk);
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
