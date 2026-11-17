// Module 4 starter: the Support page is an empty Refund Console with Ask
// Copper already open beside it.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("Support page", () => {
  it("shows the Refund Console title, a Support link in the header, and the chat already open", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    const { default: Support } = await import("@/app/support/page");
    render(<Support />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Refund Console" }),
    ).toBeVisible();
    expect(
      within(screen.getByTestId("site-header")).getByRole("link", {
        name: "Support",
      }),
    ).toHaveAttribute("href", "/support");
    const chat = within(await screen.findByTestId("ask-copper"));
    expect(chat.getByLabelText("Your question")).toBeInTheDocument();
    expect(screen.queryByTestId("ask-copper-launcher")).toBeNull();
  });

  it("shows the setup card in the chat when there is no AI key", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    const { default: Support } = await import("@/app/support/page");
    render(<Support />);
    const chat = within(await screen.findByTestId("ask-copper"));
    expect(chat.queryByLabelText("Your question")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Refund Console" }),
    ).toBeVisible();
  });
});
