import { describe, expect, it } from "vitest";
import { getProducts } from "@/lib/copper/catalog";
import { DOCUMENTS } from "@/lib/copper/documents";

describe("DOCUMENTS", () => {
  it("has a user guide for every product", () => {
    const guides = DOCUMENTS.filter((d) => d.kind === "User guide");
    expect(guides.map((d) => d.productId).sort()).toEqual(
      getProducts()
        .map((p) => p.id)
        .sort(),
    );
  });

  it("includes the terms and the Copper Plus FAQ", () => {
    expect(DOCUMENTS.map((d) => d.kind)).toEqual(
      expect.arrayContaining(["Terms", "FAQ"]),
    );
  });

  it("serves each document as a PDF under /docs/ named after its id", () => {
    for (const doc of DOCUMENTS) {
      expect(doc.file).toBe(`/docs/${doc.id}.pdf`);
    }
    expect(new Set(DOCUMENTS.map((d) => d.id)).size).toBe(DOCUMENTS.length);
  });
});
