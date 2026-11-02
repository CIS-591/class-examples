// Ask Copper, the chatbot from Module 2. Fast checks with a mock model, so
// they need no AI key and cost nothing. The four Module 2 tools must stay;
// later modules may add more.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { LanguageModelV4StreamPart as ModelStreamPart } from "@ai-sdk/provider";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { createLive, finalValue, type Live, readLive } from "@/lib/ai/live";
import type { Progress, Step } from "@/lib/copper/assistant/progress";
import { toolCallsOf } from "@/lib/copper/assistant/progress";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

// Captures the rows the app prints as "[ai_calls] {...}".
let logged: Record<string, unknown>[] = [];

// A fake stock list: whatever the test puts in `inventory`, or nothing at all
// when `inventoryUp` is false.
let inventoryUp = true;
let inventory: Record<string, unknown>[] = [];

vi.mock("@/lib/copper/inventory", () => ({
  readInventory: async () => (inventoryUp ? structuredClone(inventory) : null),
}));

// The inventory seed (Product Bible Section 10).
const INVENTORY = [
  ["CH-POL", "Copper Home", "Polished Copper", 240, "2026-11-20"],
  ["CH-TEA", "Copper Home", "Patina Teal", 6, "2026-11-06"],
  ["CH-NSK", "Copper Home", "Night Sky", 185, "2026-11-20"],
  ["CN-BRC", "Copper Notes", "Brushed Copper", 310, "2026-11-13"],
  ["CN-DSA", "Copper Notes", "Desert Sand", 92, "2026-11-13"],
  ["CN-NSK", "Copper Notes", "Night Sky", 0, "2026-11-14"],
].map(([sku, product, color, units_in_stock, next_shipment]) => ({
  sku,
  product,
  color,
  units_in_stock,
  next_shipment,
}));

// Google hands back whatever mock model the test sets.
let model: MockLanguageModelV4;
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => () => model,
}));

const usage = {
  inputTokens: {
    total: 500,
    noCache: 500,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 50, text: 50, reasoning: undefined },
};

// What the model streams back, one piece at a time.
type StreamPart = Parameters<
  typeof convertArrayToReadableStream<ModelStreamPart>
>[0][number];

const finish = (reason: "stop" | "tool-calls") => ({
  type: "finish" as const,
  finishReason: { unified: reason, raw: undefined },
  usage,
});

/** Streams a thought summary, then the text, one word at a time. */
const says = (text: string, thinking?: string): StreamPart[] => [
  ...(thinking
    ? ([
        { type: "reasoning-start", id: "r1" },
        { type: "reasoning-delta", id: "r1", delta: thinking },
        { type: "reasoning-end", id: "r1" },
      ] as StreamPart[])
    : []),
  { type: "text-start", id: "t1" },
  ...text.split(" ").map((word, i): StreamPart => ({
    type: "text-delta",
    id: "t1",
    delta: i === 0 ? word : ` ${word}`,
  })),
  { type: "text-end", id: "t1" },
  finish("stop"),
];

/** Streams a tool call: the name first, then its input. */
const calls = (toolName: string, input: unknown): StreamPart[] => [
  { type: "tool-input-start", id: "call-1", toolName },
  { type: "tool-input-delta", id: "call-1", delta: JSON.stringify(input) },
  { type: "tool-input-end", id: "call-1" },
  {
    type: "tool-call",
    toolCallId: "call-1",
    toolName,
    input: JSON.stringify(input),
  },
  finish("tool-calls"),
];

/** A mock model that streams each of `steps` in turn, one per model step. */
function modelStreaming(...steps: StreamPart[][]) {
  let step = 0;
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream(steps[step++] ?? says("")),
    }),
  });
}

/** A mock model that calls one tool, then answers with `text`. */
function modelThatCalls(toolName: string, input: unknown, text: string) {
  return modelStreaming(calls(toolName, input), says(text));
}

/** Reads a streamed answer to the end. */
async function answer(result: { progress: Live<Progress> }) {
  return finalValue(result.progress);
}

/** The three questions the panel offers before anyone has typed anything. */
const STARTERS = [
  "How much is Copper Home with Copper Plus, paid yearly, for 2 years?",
  "Is Copper Notes in Night Sky in stock?",
  "Is Copper Plus cheaper monthly or yearly?",
];

const HOME_PLUS_2_YEARS = {
  products: ["copper-home"],
  plan: "copper-plus",
  billing: "annual",
  years: 2,
};

beforeEach(() => {
  logged = [];
  vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    if (args[0] === "[ai_calls]") logged.push(JSON.parse(args[1] as string));
  });
  inventoryUp = true;
  inventory = structuredClone(INVENTORY);
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/copper/catalog");
  vi.doUnmock("@/lib/copper/assistant/ask");
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Part A (AC-M2.1 to AC-M2.4): the Ask Copper chat widget
// ---------------------------------------------------------------------------

async function renderPage() {
  vi.resetModules();
  const { default: Home } = await import("@/app/page");
  const page = Home as unknown as () =>
    React.ReactNode | Promise<React.ReactNode>;
  const ui =
    Home.constructor.name === "AsyncFunction" ? await page() : <Home />;
  return render(<>{ui}</>);
}

/** Clicks the floating Ask Copper button and returns the chat panel. */
async function openChat() {
  fireEvent.click(screen.getByTestId("ask-copper-launcher"));
  return screen.findByTestId("ask-copper");
}

function useToolsSwitch(chat: ReturnType<typeof within>) {
  return (
    chat.queryByRole("switch", { name: /use tools/i }) ??
    chat.getByRole("checkbox", { name: /use tools/i })
  );
}

/** A finished answer, as the panel receives it from askCopper. */
function answered(reply: string, steps: Progress["steps"] = []) {
  const done = createLive<Progress>();
  done.done({ steps, reply, status: "done" });
  return { progress: done.live };
}

/** A tool step that has already run. */
const toolStep = (name: string, input: unknown, output: unknown): Step => ({
  type: "tool",
  id: "call-1",
  name,
  state: "done",
  input,
  output,
});

async function ask(chat: ReturnType<typeof within>, question: string) {
  fireEvent.change(chat.getByRole("textbox"), { target: { value: question } });
  fireEvent.click(chat.getByRole("button", { name: /send/i }));
}

describe("Part A: the Ask Copper chat widget", () => {
  it("AC-M2.1 A floating Ask Copper button opens the chat panel, which offers the starter questions; the header link and /#ask open it too", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "AIza-test-key");
    const askCopper = vi.fn().mockImplementation(async () => answered("Sure."));
    vi.doMock("@/lib/copper/assistant/ask", () => ({ askCopper }));
    const { container } = await renderPage();
    expect(
      screen.queryByTestId("ask-copper"),
      "the panel starts closed",
    ).toBeNull();
    const launcher = screen.getByTestId("ask-copper-launcher");
    expect(launcher).toHaveAccessibleName(/ask copper/i);
    const header = container.querySelector('[data-testid="site-header"]')!;
    const hrefs = [...header.querySelectorAll("a")].map(
      (a) => a.getAttribute("href") ?? "",
    );
    expect(
      hrefs.some((href) => href.endsWith("#ask")),
      "header link to #ask",
    ).toBe(true);

    const panel = await openChat();
    expect(panel).toHaveAttribute("role", "dialog");
    expect(panel).toHaveAccessibleName(/ask copper/i);

    // An empty chat offers the three starter questions as buttons, so a
    // shopper can see what Copper is for without typing anything.
    const chat = within(panel);
    for (const starter of STARTERS) {
      expect(
        chat.getByRole("button", { name: starter }),
        `starter question button: ${starter}`,
      ).toBeInTheDocument();
    }

    // Clicking one asks it straight away...
    fireEvent.click(chat.getByRole("button", { name: STARTERS[1] }));
    await waitFor(() => expect(askCopper).toHaveBeenCalledTimes(1));
    expect(askCopper.mock.calls[0][0].messages).toEqual([
      { role: "user", content: STARTERS[1] },
    ]);
    // ...and they stay on offer once the answer has landed, so a shopper can
    // keep going without typing.
    await waitFor(() => expect(chat.getByText("Sure.")).toBeInTheDocument());
    for (const starter of STARTERS) {
      expect(
        chat.getByRole("button", { name: starter }),
        `starter still offered after an answer: ${starter}`,
      ).toBeInTheDocument();
    }
    // Clicking a second one carries the conversation so far.
    fireEvent.click(chat.getByRole("button", { name: STARTERS[0] }));
    await waitFor(() => expect(askCopper).toHaveBeenCalledTimes(2));
    expect(askCopper.mock.calls[1][0].messages).toHaveLength(3);
    expect(askCopper.mock.calls[1][0].messages.at(-1)).toEqual({
      role: "user",
      content: STARTERS[0],
    });
    cleanup();

    // Opening the site at /#ask opens the panel by itself.
    window.history.replaceState(null, "", "/#ask");
    await renderPage();
    expect(await screen.findByTestId("ask-copper")).toBeInTheDocument();
  });

  it("AC-M2.2 Without an AI key, the panel shows the setup card instead of the chat", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    await renderPage();
    const panel = await openChat();
    expect(
      within(panel).getByText(/set up .+ to use this page/i),
    ).toBeInTheDocument();
    expect(within(panel).queryByRole("textbox")).toBeNull();
  });

  it("AC-M2.3 A question shows Copper's reply; tools on and tools off are separate conversations, each sent with its own history", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "AIza-test-key");
    const askCopper = vi
      .fn()
      .mockImplementation(async () =>
        answered("Copper Home with Copper Plus for 2 years comes to $307."),
      );
    vi.doMock("@/lib/copper/assistant/ask", () => ({ askCopper }));
    await renderPage();
    const chat = within(await openChat());
    const toolsSwitch = useToolsSwitch(chat);

    await ask(chat, "How much is Copper Home with Plus for 2 years?");
    await waitFor(() =>
      expect(chat.getByText(/comes to \$307/)).toBeInTheDocument(),
    );
    expect(
      chat.getByText("How much is Copper Home with Plus for 2 years?"),
    ).toBeInTheDocument();
    expect(askCopper.mock.calls[0][0]).toEqual({
      messages: [
        {
          role: "user",
          content: "How much is Copper Home with Plus for 2 years?",
        },
      ],
      useTools: true,
    });

    // A follow-up in the same conversation carries the earlier turns.
    await ask(chat, "And for 3 years?");
    await waitFor(() => expect(askCopper).toHaveBeenCalledTimes(2));
    expect(askCopper.mock.calls[1][0].messages).toHaveLength(3);
    await waitFor(() =>
      expect(chat.getAllByText(/comes to \$307/)).toHaveLength(2),
    );

    // Tools off is a fresh conversation: nothing from the tools-on chat is
    // shown or sent, so the model can't copy an answer the tools worked out.
    fireEvent.click(toolsSwitch);
    expect(chat.queryByText(/comes to \$307/)).toBeNull();
    await ask(chat, "How much is Copper Home with Plus for 2 years?");
    await waitFor(() => expect(askCopper).toHaveBeenCalledTimes(3));
    expect(askCopper.mock.calls[2][0]).toEqual({
      messages: [
        {
          role: "user",
          content: "How much is Copper Home with Plus for 2 years?",
        },
      ],
      useTools: false,
    });

    // Switching back shows the tools-on conversation again.
    await waitFor(() =>
      expect(chat.getAllByText(/comes to \$307/)).toHaveLength(1),
    );
    fireEvent.click(toolsSwitch);
    expect(chat.getByText("And for 3 years?")).toBeInTheDocument();
  });

  it("AC-M2.4 Each tool call shows as an open card before the reply: the tool, what Copper sent and what came back", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "AIza-test-key");
    const askCopper = vi
      .fn()
      .mockResolvedValueOnce(
        answered("That comes to $307 over two years.", [
          toolStep("calculate_cost", HOME_PLUS_2_YEARS, {
            lines: [
              { item: "Copper Home", usd: 149 },
              { item: "Copper Plus, annual, 2 years", usd: 158 },
            ],
            totalUsd: 307,
          }),
        ]),
      )
      .mockResolvedValueOnce(answered("Probably about $300."));
    vi.doMock("@/lib/copper/assistant/ask", () => ({ askCopper }));
    await renderPage();
    const section = await openChat();
    const chat = within(section);

    await ask(chat, "Copper Home with Plus, yearly, for 2 years?");
    await waitFor(() =>
      expect(chat.getByText(/comes to \$307/)).toBeInTheDocument(),
    );

    const cards = section.querySelectorAll<HTMLElement>(
      '[data-testid="tool-call"]',
    );
    expect(cards).toHaveLength(1);
    const card = within(cards[0]);
    expect(cards[0].dataset.tool).toBe("calculate_cost");
    expect(card.getAllByText(/calculate_cost/).length).toBeGreaterThan(0);
    // Open without a click: what Copper sent...
    expect(card.getByText(/what copper sent/i)).toBeVisible();
    expect(cards[0].textContent).toMatch(/copper.home/i);
    expect(cards[0].textContent).toMatch(/annual/i);
    // ...and what came back, with each line and the total.
    expect(card.getByText(/what came back/i)).toBeVisible();
    expect(card.getByText(/Copper Plus, annual, 2 years/)).toBeVisible();
    expect(cards[0].textContent).toContain("$307");
    // The card comes before Copper's reply: the tool ran first.
    const reply = chat.getByText(/comes to \$307/);
    expect(
      cards[0].compareDocumentPosition(reply) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // An answer given without tools is labeled as unchecked, in its own chat.
    fireEvent.click(useToolsSwitch(chat));
    await ask(chat, "Same question, no tools?");
    await waitFor(() =>
      expect(chat.getByText(/about \$300/)).toBeInTheDocument(),
    );
    expect(section.querySelectorAll('[data-testid="tool-call"]')).toHaveLength(
      0,
    );
    expect(chat.getByText(/answered without tools/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Part B (AC-M2.5 to AC-M2.10): the two tools
// ---------------------------------------------------------------------------

async function loadTools() {
  vi.resetModules();
  return import("@/lib/copper/assistant/tools");
}

const total = async (input: unknown) => {
  const { calculateCost, calculateCostInput } = await loadTools();
  return calculateCost(calculateCostInput.parse(input)).totalUsd;
};

describe("Part B: the pricing tools", () => {
  it("AC-M2.5 calculate_cost gets the totals right", async () => {
    // Copper Home + Copper Plus paid yearly for 2 years: $149 + 2 x $79.
    expect(await total(HOME_PLUS_2_YEARS)).toBe(307);
    // Copper Plus covers the whole household, so it's counted once.
    expect(
      await total({
        products: ["copper-home", "copper-notes"],
        plan: "copper-plus",
        billing: "monthly",
        years: 1,
      }),
    ).toBe(373.88);
    // Two Copper Homes on the free plan for 3 years.
    expect(
      await total({
        products: ["copper-home", "copper-home"],
        plan: "free",
        billing: "monthly",
        years: 3,
      }),
    ).toBe(298);
    // Just the subscription: monthly vs. annual over one year.
    expect(
      await total({
        products: [],
        plan: "copper-plus",
        billing: "monthly",
        years: 1,
      }),
    ).toBe(95.88);
    expect(
      await total({
        products: [],
        plan: "copper-plus",
        billing: "annual",
        years: 1,
      }),
    ).toBe(79);

    // The line items add up to the total.
    const { calculateCost, calculateCostInput } = await loadTools();
    const result = calculateCost(calculateCostInput.parse(HOME_PLUS_2_YEARS));
    expect(result.lines.length).toBeGreaterThan(0);
    const sum = result.lines.reduce((s, line) => s + line.usd, 0);
    expect(Math.round(sum * 100) / 100).toBe(result.totalUsd);
  });

  it("AC-M2.6 calculate_cost and get_prices follow the catalog when prices change", async () => {
    vi.doMock("@/lib/copper/catalog", async (importOriginal) => {
      const real =
        await importOriginal<typeof import("@/lib/copper/catalog")>();
      return {
        ...real,
        getProducts: () =>
          real.getProducts().map((p) => ({ ...p, priceUsd: p.priceUsd + 50 })),
        getPlans: () =>
          real
            .getPlans()
            .map((p) =>
              p.id === "copper-plus"
                ? { ...p, monthlyUsd: 9.49, annualUsd: 95 }
                : p,
            ),
      };
    });
    // $199 + 2 x $95
    expect(await total(HOME_PLUS_2_YEARS)).toBe(389);
    const { getPrices } = await loadTools();
    const prices = JSON.stringify(getPrices());
    expect(prices).toContain("199");
    expect(prices).toContain("9.49");
    expect(prices).not.toContain("149");
  });

  it("AC-M2.7 calculate_cost rejects input outside its contract", async () => {
    const { calculateCostInput } = await loadTools();
    const ok = {
      products: ["copper-home"],
      plan: "free",
      billing: "monthly",
      years: 1,
    };
    expect(calculateCostInput.safeParse(ok).success).toBe(true);
    const bad = [
      { ...ok, products: ["copper-watch"] }, // not a Copper product
      { ...ok, plan: "gold" }, // not a plan
      { ...ok, billing: "weekly" },
      { ...ok, years: 0 },
      { ...ok, years: 6 }, // 1 to 5 years
      { ...ok, years: 1.5 }, // whole years only
      { ...ok, products: Array(6).fill("copper-home") }, // at most 5 devices
    ];
    for (const input of bad)
      expect(
        calculateCostInput.safeParse(input).success,
        JSON.stringify(input),
      ).toBe(false);
  });

  it("AC-M2.8 get_products and get_prices return the catalog, and all four tools are described for the model", async () => {
    const { listProducts, getPrices, copperTools } = await loadTools();
    expect(listProducts().products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "copper-notes",
          name: "Copper Notes",
          colors: ["Brushed Copper", "Desert Sand", "Night Sky"],
        }),
        expect.objectContaining({
          id: "copper-home",
          colors: expect.arrayContaining(["Patina Teal"]),
        }),
      ]),
    );
    const prices = getPrices();
    expect(prices.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "copper-home",
          name: "Copper Home",
          priceUsd: 149,
        }),
        expect.objectContaining({
          id: "copper-notes",
          name: "Copper Notes",
          priceUsd: 129,
        }),
      ]),
    );
    expect(prices.plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "free", monthlyUsd: 0, annualUsd: 0 }),
        expect.objectContaining({
          id: "copper-plus",
          monthlyUsd: 7.99,
          annualUsd: 79,
        }),
      ]),
    );
    expect(Object.keys(copperTools)).toEqual(
      expect.arrayContaining([
        "calculate_cost",
        "check_availability",
        "get_prices",
        "get_products",
      ]),
    );
    for (const [name, tool] of Object.entries(copperTools)) {
      expect(tool.description, `${name} has a description`).toMatch(/\w{4,}/);
      expect(typeof tool.execute, `${name} can run`).toBe("function");
    }
  });

  it("AC-M2.9 check_availability reads the stock list: in stock, low stock (under 10) or back-ordered with its date", async () => {
    const { checkAvailability } = await loadTools();
    const notes = await checkAvailability({ product: "copper-notes" });
    expect(notes.status).toBe("ok");
    if (notes.status !== "ok") return;
    expect(notes.product).toBe("Copper Notes");
    expect(notes.colors).toEqual(
      expect.arrayContaining([
        { color: "Brushed Copper", stock: "in_stock", restockDate: null },
        { color: "Desert Sand", stock: "in_stock", restockDate: null },
        { color: "Night Sky", stock: "backordered", restockDate: "2026-11-14" },
      ]),
    );
    expect(notes.colors).toHaveLength(3);

    // One color, any capitalization.
    const teal = await checkAvailability({
      product: "copper-home",
      color: "patina teal",
    });
    expect(teal).toEqual({
      status: "ok",
      product: "Copper Home",
      colors: [{ color: "Patina Teal", stock: "low_stock", restockDate: null }],
    });

    // It reads the stock list each time: change the stock, and the answer changes.
    inventory.find((row) => row.sku === "CN-NSK")!.units_in_stock = 40;
    const restocked = await checkAvailability({
      product: "copper-notes",
      color: "Night Sky",
    });
    expect(restocked).toMatchObject({
      status: "ok",
      colors: [{ color: "Night Sky", stock: "in_stock", restockDate: null }],
    });
  });

  it("AC-M2.10 check_availability says when a color doesn't exist or stock can't be checked, instead of guessing", async () => {
    const { checkAvailability, checkAvailabilityInput } = await loadTools();
    // Copper Notes doesn't come in Patina Teal: that's not "out of stock".
    expect(
      await checkAvailability({
        product: "copper-notes",
        color: "Patina Teal",
      }),
    ).toEqual({
      status: "not_a_color",
      product: "Copper Notes",
      color: "Patina Teal",
      colors: ["Brushed Copper", "Desert Sand", "Night Sky"],
    });
    // Stock can't be read: no made-up stock levels.
    inventoryUp = false;
    const down = await checkAvailability({ product: "copper-home" });
    expect(down.status).toBe("unavailable");
    expect(JSON.stringify(down)).not.toMatch(/in_stock|low_stock|backordered/);
    // The contract: a Copper product, and an optional color.
    expect(
      checkAvailabilityInput.safeParse({ product: "copper-home" }).success,
    ).toBe(true);
    expect(
      checkAvailabilityInput.safeParse({ product: "copper-watch" }).success,
    ).toBe(false);
    expect(checkAvailabilityInput.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Part C (AC-M2.11 to AC-M2.12): askCopper, the server action that talks to the model
// ---------------------------------------------------------------------------

async function loadAsk() {
  vi.resetModules();
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "AIza-test-key");
  return import("@/lib/copper/assistant/ask");
}

const question = [
  {
    role: "user" as const,
    content: "Copper Home with Plus, yearly, for 2 years?",
  },
];

describe("Part C: askCopper", () => {
  it("AC-M2.11 When the model calls a tool, the tool runs and Copper's reply comes back with the tool call", async () => {
    model = modelThatCalls(
      "calculate_cost",
      HOME_PLUS_2_YEARS,
      "That comes to $307.",
    );
    const { askCopper } = await loadAsk();
    const result = await answer(
      await askCopper({ messages: question, useTools: true }),
    );
    expect(result.reply).toBe("That comes to $307.");
    expect(result.status).toBe("done");
    const toolCalls = toolCallsOf(result);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]).toMatchObject({
      name: "calculate_cost",
      input: HOME_PLUS_2_YEARS,
      output: expect.objectContaining({ totalUsd: 307 }),
    });
    // The tool's answer was handed back to the model for its reply.
    expect(JSON.stringify(model.doStreamCalls[1].prompt)).toContain("307");
  });

  it("AC-M2.12 The answer streams in: thinking, then the tool call, then the reply, each update carrying everything so far", async () => {
    model = modelStreaming(
      calls("calculate_cost", HOME_PLUS_2_YEARS),
      says(
        "That comes to $307.",
        "The shopper wants a 2-year total, so I'll use calculate_cost.",
      ),
    );
    const { askCopper } = await loadAsk();
    const updates: Progress[] = [];
    for await (const update of readLive(
      (await askCopper({ messages: question, useTools: true })).progress,
    )) {
      updates.push(update);
    }

    // The tool is named before its input is known, so the panel can say
    // which tool Copper is using while it's still filling in the details.
    const naming = updates.find((u) => u.steps.some((s) => s.type === "tool"))!;
    const firstTool = naming.steps.find((s) => s.type === "tool")!;
    expect(firstTool).toMatchObject({
      name: "calculate_cost",
      state: "calling",
    });
    expect(
      updates.some((u) =>
        u.steps.some((s) => s.type === "tool" && s.state === "done"),
      ),
    ).toBe(true);

    // Gemini's thought summary arrives as a thinking step.
    const thinking = updates.at(-1)!.steps.find((s) => s.type === "thinking");
    expect(thinking?.text).toContain("calculate_cost");

    // The reply builds up a piece at a time, and never goes backwards.
    const replies = updates.map((u) => u.reply);
    expect(
      new Set(replies).size,
      "the reply arrives in pieces",
    ).toBeGreaterThan(2);
    for (let i = 1; i < replies.length; i++) {
      expect(replies[i].startsWith(replies[i - 1])).toBe(true);
    }
    expect(updates.at(-1)).toMatchObject({
      reply: "That comes to $307.",
      status: "done",
    });
  });

  it("AC-M2.13 Each question is logged as module 2, feature ask-copper, with the model that answered", async () => {
    model = modelThatCalls("get_prices", {}, "Copper Home is $149.");
    const { askCopper } = await loadAsk();
    await answer(await askCopper({ messages: question, useTools: true }));
    await vi.waitFor(() => expect(logged).toHaveLength(1));
    expect(logged[0]).toMatchObject({
      module: 2,
      feature: "ask-copper",
      model: "google/gemini-2.5-flash",
      ok: true,
    });
  });

  it("AC-M2.14 With tools off, the model gets no instructions and no tools; with tools on, it gets the four tools", async () => {
    model = modelStreaming(says("About $300?"));
    let { askCopper } = await loadAsk();
    const off = await answer(
      await askCopper({ messages: question, useTools: false }),
    );
    expect(off.reply).toBe("About $300?");
    expect(toolCallsOf(off)).toEqual([]);
    expect(model.doStreamCalls[0].tools ?? []).toHaveLength(0);
    // Nothing is telling it to check anything: no system message at all.
    const sent = model.doStreamCalls[0].prompt;
    expect(
      sent.find((m) => m.role === "system"),
      "no instructions with tools off",
    ).toBeUndefined();

    model = modelStreaming(says("ok"));
    ({ askCopper } = await loadAsk());
    await answer(await askCopper({ messages: question, useTools: true }));
    const names = (model.doStreamCalls[0].tools ?? []).map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "calculate_cost",
        "check_availability",
        "get_prices",
        "get_products",
      ]),
    );
  });

  it("AC-M2.15 Copper's instructions are written and sent to the model, and the conversation is passed along", async () => {
    const { COPPER_INSTRUCTIONS } =
      await import("@/lib/copper/assistant/instructions");
    expect(COPPER_INSTRUCTIONS).not.toMatch(/TODO/);
    expect(
      COPPER_INSTRUCTIONS.split(/\s+/).length,
      "at least 40 words",
    ).toBeGreaterThanOrEqual(40);

    model = modelStreaming(says("Sure."));
    const { askCopper } = await loadAsk();
    await answer(
      await askCopper({
        messages: [
          { role: "user", content: "Hi Copper" },
          { role: "assistant", content: "Hi! How can I help?" },
          { role: "user", content: "What does Copper Plus cost?" },
        ],
        useTools: true,
      }),
    );
    const prompt = model.doStreamCalls[0].prompt;
    const system = prompt.find((m) => m.role === "system");
    expect(system?.content).toContain(COPPER_INSTRUCTIONS.slice(0, 40));
    const text = JSON.stringify(prompt);
    expect(text).toContain("Hi Copper");
    expect(text).toContain("What does Copper Plus cost?");
  });
});
