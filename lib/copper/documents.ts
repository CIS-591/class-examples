// Copper State Labs' customer documents. The PDFs aren't in the repo: they're
// added to public/docs/ in class, so each one is served at its `file` path.
import type { ProductId } from "@/lib/copper/catalog";

export type CopperDocument = {
  id: string;
  title: string;
  kind: "User guide" | "Terms" | "FAQ";
  /** The product it's about, when it's about just one. */
  productId?: ProductId;
  /** Path under public/, which is also the URL the PDF is served at. */
  file: string;
};

export const DOCUMENTS: CopperDocument[] = [
  {
    id: "copper-home-user-guide",
    title: "Copper Home User Guide",
    kind: "User guide",
    productId: "copper-home",
    file: "/docs/copper-home-user-guide.pdf",
  },
  {
    id: "copper-notes-user-guide",
    title: "Copper Notes User Guide",
    kind: "User guide",
    productId: "copper-notes",
    file: "/docs/copper-notes-user-guide.pdf",
  },
  {
    id: "copper-terms-and-conditions",
    title: "Copper State Labs Terms and Conditions",
    kind: "Terms",
    file: "/docs/copper-terms-and-conditions.pdf",
  },
  {
    id: "copper-plus-faq",
    title: "Copper Plus FAQ",
    kind: "FAQ",
    file: "/docs/copper-plus-faq.pdf",
  },
];
