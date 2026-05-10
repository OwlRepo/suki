import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SukiAssistant } from "./suki-assistant";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("token") }),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(async (path: string) => {
    if (path.startsWith("/ai/usage/summary")) {
      return {
        tokensUsed: 100,
        tokensLimit: 1000,
        requestsUsed: 10,
        requestsLimit: 100,
        resetDate: "2026-06-01",
        aiEnabled: true,
      };
    }
    return { domain: "help", humanReadable: "Open Customers to add a customer." };
  }),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ activeBusinessId: "biz-1" }),
}));

describe("SukiAssistant", () => {
  it("opens panel, shows usage strip, and suggested prompts", async () => {
    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));

    await waitFor(() => {
      expect(screen.getByText(/resets on/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/what can i ask/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /how do i add a customer/i })).toBeInTheDocument();
  });

  it("shows helper drawer content", async () => {
    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));

    fireEvent.click(screen.getByRole("button", { name: /what can i ask\?/i }));
    expect(await screen.findByText(/daily tasks/i)).toBeInTheDocument();
  });

  it("supports collapsing and expanding the header snapshot block", async () => {
    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));

    expect(await screen.findByText(/ai usage snapshot/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /collapse assistant header/i }));
    expect(screen.queryByText(/ai usage snapshot/i)).not.toBeInTheDocument();
    expect(screen.getByText(/status:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand assistant header/i }));
    expect(await screen.findByText(/ai usage snapshot/i)).toBeInTheDocument();
  });

  it("renders suggestion chips in a horizontal scroll row", async () => {
    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));

    const chipRow = await screen.findByTestId("assistant-prompt-row");
    expect(chipRow.className).toContain("overflow-x-auto");
    expect(chipRow.className).toContain("flex-nowrap");
  });
});
