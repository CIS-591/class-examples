// The course's approved models. Calls go straight to Google with a Google AI
// Studio key, which is free and needs no credit card.
export const MODELS = [
  {
    id: "google/gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite (fastest and cheapest; works with new keys)",
    googleId: "gemini-3.5-flash-lite",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash (fast, shows its thinking)",
    // Google's own name for it, used when calling Google.
    googleId: "gemini-2.5-flash",
  },
  {
    id: "google/gemini-3-flash",
    label: "Gemini 3 Flash (newer, thinks out loud less often)",
    googleId: "gemini-3-flash-preview",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

/**
 * The model used when a call doesn't name one (Module 5). Google keys made
 * after mid-2026 can't call 2.5 Flash, and Flash-Lite is the cheapest model
 * they can call. Set AI_MODEL to pick another approved model.
 */
export const DEFAULT_MODEL: ModelId = "google/gemini-3.5-flash-lite";

/**
 * Turns text into a list of numbers so similar meanings can be found (Module 3).
 * It isn't a chat model, so it isn't in MODELS.
 */
export const EMBEDDING_MODEL = "google/gemini-embedding-2";
/** Shorter than the 3072 default: a smaller passages.json, almost as accurate. */
export const EMBEDDING_DIMENSIONS = 768;

/** AI_MODEL if it names an approved model, otherwise the default. */
export function defaultModel(): ModelId {
  const id = process.env.AI_MODEL;
  return MODELS.find((m) => m.id === id)?.id ?? DEFAULT_MODEL;
}
