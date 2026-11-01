import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SupportPage from "@/app/support/page";
import { SiteHeader } from "@/components/copper/site-header";
import { getProducts } from "@/lib/copper/catalog";
import { DOCUMENTS } from "@/lib/copper/documents";

vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme: vi.fn() }) }));

describe("Support page shell", () => {
  it("has the site header, a Support heading and the footer", () => {
    render(<SupportPage />);
    expect(screen.getByTestId("site-header")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Support" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("is linked from the site header", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute(
      "href",
      "/support",
    );
  });
});

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
