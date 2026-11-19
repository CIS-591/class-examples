// The tools Ask Copper can use. Products and prices come from
// lib/copper/catalog.ts and stock from lib/copper/inventory.ts (Module 2);
// search_docs finds passages in the customer documents (Module 3). So the
// chatbot never has to make them up.
// Module 4: on the Support page, Copper can hand refunds to the Refund agent
// (transfer_to_refund_agent), a second agent with its own tools
// (refundAgentTools, below) built on the orders and the refund rule in
// lib/copper/orders.ts.
// Each tool returns plain data; the model writes the reply around it.
import { tool } from "ai";
import { z } from "zod";
import { callEmbedMany } from "@/lib/ai/call";
import {
  getPlans,
  getProducts,
  type Plan,
  type ProductId,
} from "@/lib/copper/catalog";
import { DOCUMENTS, pageUrl } from "@/lib/copper/documents";
import { readInventory } from "@/lib/copper/inventory";
import { PASSAGES } from "@/lib/copper/passages";
import {
  type Desk,
  ordersWithRefunds,
  requestRefund,
} from "@/lib/copper/orders";

export type ProductList = {
  products: {
    id: ProductId;
    name: string;
    type: string;
    priceUsd: number;
    colors: string[];
  }[];
};

export type Prices = {
  products: { id: ProductId; name: string; priceUsd: number }[];
  plans: {
    id: Plan["id"];
    name: string;
    monthlyUsd: number;
    annualUsd: number;
  }[];
};

export type CalculateCostInput = {
  products: ProductId[];
  plan: Plan["id"];
  billing: "monthly" | "annual";
  years: number;
};

export type CostBreakdown = {
  lines: { item: string; usd: number }[];
  totalUsd: number;
};

export type CheckAvailabilityInput = { product: ProductId; color?: string };

export type Stock = "in_stock" | "low_stock" | "backordered";

export type Availability =
  | {
      status: "ok";
      product: string;
      colors: { color: string; stock: Stock; restockDate: string | null }[];
    }
  | { status: "not_a_color"; product: string; color: string; colors: string[] }
  | { status: "unavailable"; message: string };

/** get_products: what Copper sells and which colors each one comes in. */
export function listProducts(): ProductList {
  return {
    products: getProducts().map(({ id, name, type, priceUsd, colors }) => ({
      id,
      name,
      type,
      priceUsd,
      colors,
    })),
  };
}

/** get_prices: every product and plan price, read from the catalog. */
export function getPrices(): Prices {
  return {
    products: getProducts().map(({ id, name, priceUsd }) => ({
      id,
      name,
      priceUsd,
    })),
    plans: getPlans().map(({ id, name, monthlyUsd, annualUsd }) => ({
      id,
      name,
      monthlyUsd,
      annualUsd,
    })),
  };
}

const productId = z.enum(["copper-home", "copper-notes"]);

export const calculateCostInput = z.object({
  products: z.array(productId).max(5),
  plan: z.enum(["free", "copper-plus"]),
  billing: z.enum(["monthly", "annual"]),
  years: z.number().int().min(1).max(5),
}) satisfies z.ZodType<CalculateCostInput>;

const cents = (usd: number) => Math.round(usd * 100) / 100;

/** calculate_cost: the total cost of devices plus a plan over some years. */
export function calculateCost(input: CalculateCostInput): CostBreakdown {
  const products = getProducts();
  const lines = input.products.map((id) => {
    const product = products.find((p) => p.id === id)!;
    return { item: product.name, usd: cents(product.priceUsd) };
  });
  const plan = getPlans().find((p) => p.id === input.plan)!;
  const planUsd =
    input.billing === "monthly"
      ? plan.monthlyUsd * 12 * input.years
      : plan.annualUsd * input.years;
  // The free plan costs nothing, so it adds no line.
  if (planUsd > 0) {
    const years = input.years === 1 ? "1 year" : `${input.years} years`;
    lines.push({
      item: `${plan.name}, ${input.billing}, ${years}`,
      usd: cents(planUsd),
    });
  }
  return { lines, totalUsd: cents(lines.reduce((sum, l) => sum + l.usd, 0)) };
}

export const checkAvailabilityInput = z.object({
  product: productId,
  color: z.string().optional(),
}) satisfies z.ZodType<CheckAvailabilityInput>;

function stockOf(units: number): Stock {
  if (units === 0) return "backordered";
  return units < 10 ? "low_stock" : "in_stock";
}

/** check_availability: stock for one product (or one of its colors), read fresh each time. */
export async function checkAvailability(
  input: CheckAvailabilityInput,
): Promise<Availability> {
  const product = getProducts().find((p) => p.id === input.product)!;
  const wanted = input.color?.trim().toLowerCase();
  const colors = wanted
    ? product.colors.filter((c) => c.toLowerCase() === wanted)
    : product.colors;
  if (input.color && colors.length === 0) {
    return {
      status: "not_a_color",
      product: product.name,
      color: input.color,
      colors: product.colors,
    };
  }
  const rows = await readInventory();
  if (!rows) {
    return {
      status: "unavailable",
      message: "Stock can't be checked right now. Please try again soon.",
    };
  }
  return {
    status: "ok",
    product: product.name,
    colors: colors.flatMap((color) => {
      const row = rows.find(
        (r) =>
          r.product === product.name &&
          r.color.toLowerCase() === color.toLowerCase(),
      );
      if (!row) return [];
      const stock = stockOf(row.units_in_stock);
      return [
        {
          color,
          stock,
          restockDate: stock === "backordered" ? row.next_shipment : null,
        },
      ];
    }),
  };
}

export type DocMatch = {
  title: string;
  page: number;
  /** Opens the PDF at that page. */
  url: string;
  /** The passage, without the document title it was embedded with. */
  text: string;
  /** How close in meaning to the query: 1 is identical. */
  score: number;
};

export type DocSearchResult = { matches: DocMatch[] };

const SEARCH_RESULTS = 5;

/** Cosine similarity: how closely two embeddings point the same way. */
function similarity(a: number[], b: number[]): number {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return dot / Math.sqrt(aa * bb);
}

/** search_docs: the passages in the customer documents closest in meaning to the query. */
export async function searchDocs(query: string): Promise<DocSearchResult> {
  const {
    embeddings: [embedding],
  } = await callEmbedMany({ module: 3, feature: "search-docs" }, [query]);
  const matches = PASSAGES.map((passage) => ({
    passage,
    score: similarity(embedding, passage.embedding),
  }))
    .sort((a, b) => b.score - a.score)
    .slice(0, SEARCH_RESULTS)
    .map(({ passage, score }) => {
      const doc = DOCUMENTS.find((d) => d.id === passage.documentId)!;
      return {
        title: passage.title,
        page: passage.page,
        url: pageUrl(doc, passage.page),
        text: passage.text.slice(`${passage.title}: `.length),
        score: Math.round(score * 100) / 100,
      };
    });
  return { matches };
}

export const copperTools = {
  get_products: tool({
    description:
      "Lists every Copper product with its type, price and the colors it comes in.",
    inputSchema: z.object({}),
    execute: async () => listProducts(),
  }),
  get_prices: tool({
    description: "Gets the price of every Copper product and plan.",
    inputSchema: z.object({}),
    execute: async () => getPrices(),
  }),
  calculate_cost: tool({
    description:
      "Works out the total cost of Copper devices plus a plan over 1 to 5 years.",
    inputSchema: calculateCostInput,
    execute: async (input) => calculateCost(input),
  }),
  check_availability: tool({
    description:
      "Checks today's stock for a Copper product, for every color or just one.",
    inputSchema: checkAvailabilityInput,
    execute: async (input) => checkAvailability(input),
  }),
  search_docs: tool({
    description:
      "Searches Copper's customer documents (the Copper Home and Copper Notes user guides, the Terms and Conditions, and the Copper Plus FAQ). Returns the 5 passages closest in meaning to the query, each with its document title, page number and a link to that page.",
    inputSchema: z.object({
      query: z
        .string()
        .min(2)
        .describe(
          "What to look for, with the product name if known, e.g. 'reset Wi-Fi on Copper Home'.",
        ),
    }),
    execute: async ({ query }) => searchDocs(query),
  }),
};

/** Copper's handoff to the Refund agent (Module 4): only on the Support page. */
export const transferToRefundAgent = tool({
  description:
    "Hands the customer to the Refund agent, which handles refunds and refund status. The Refund agent answers next, so write no reply of your own.",
  inputSchema: z.object({
    reason: z
      .string()
      .describe("Why, in a few words, like 'refund order #1001'."),
  }),
  execute: async () => ({ handedTo: "Refund agent" }),
});

/** The Refund agent's own tools (Module 4). Copper can't use these. */
export function refundAgentTools(desk: Desk) {
  return {
    get_orders: tool({
      description:
        "Lists the customer's orders: number, item, amount, date, and any refund so far (none, refunded, waiting or rejected).",
      inputSchema: z.object({}),
      execute: async () => ordersWithRefunds(desk),
    }),
    request_refund: tool({
      description:
        "Asks the app to refund one order. The app compares the amount with the auto-refund limit: refunded means the money is on its way; needs_approval means it waits for a supervisor on the Refund Console. It may also say the order was already refunded, is waiting, was rejected, or doesn't exist.",
      inputSchema: z.object({
        orderId: z.string().describe("The order number, like 1001."),
      }),
      execute: async ({ orderId }) => requestRefund(orderId, desk),
    }),
    transfer_to_copper: tool({
      description:
        "Hands the customer back to Copper for anything that isn't a refund (products, prices, stock, setup, policies). Copper answers next, so write no reply of your own.",
      inputSchema: z.object({
        reason: z.string().describe("Why, in a few words."),
      }),
      execute: async () => ({ handedTo: "Copper" }),
    }),
  };
}
