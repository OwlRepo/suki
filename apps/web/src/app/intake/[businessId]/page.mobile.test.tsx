// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import IntakePage from "./page";

describe("IntakePage mobile validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => store.set(key, value)),
      removeItem: vi.fn((key: string) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
    });
  });

  it("shows +63 guidance and blocks invalid mobile before saving details", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/intake/config")) {
        return new Response(JSON.stringify({ template: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      render(
        <Suspense fallback={<div>Loading</div>}>
          <IntakePage params={Promise.resolve({ businessId: "biz1" })} />
        </Suspense>,
      );
    });

    expect(await screen.findByPlaceholderText("+639171234567")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/Mobile/i), { target: { value: "09171234567" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("+639171234567");
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining("/intake"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
