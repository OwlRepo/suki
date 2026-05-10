import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SukiAssistant } from "./suki-assistant";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(async (path: string) => {
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
    if (path.startsWith("/help/assistant/chat")) {
      return {
        plainAnswer: "Add customers from the Customers page.",
        nextStep: "Tap Add customer now.",
        details: "This helps you track visits and appointments.",
        actionChips: [
          { label: "Add customer now", href: "/customers", kind: "primary" },
          { label: "Learn in Help Center", href: "/help", kind: "secondary" },
        ],
      };
    }
    return {};
  }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("cookie-session") }),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ activeBusinessId: "biz-1" }),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: apiRequestMock,
}));

describe("SukiAssistant orchestration UI", () => {
  it("uses stream endpoint as normal path and does not call /chat fallback", async () => {
    const streamBody = [
      'event: meta\ndata: {"type":"meta","threadId":"thread-1","intent":"how_to"}\n\n',
      'event: state\ndata: {"type":"state","state":"streaming"}\n\n',
      'event: done\ndata: {"type":"done","response":{"threadId":"thread-1","plainAnswer":"Open Customers.","nextStep":"Tap Add customer now.","actionChips":[{"label":"Add customer now","href":"/customers","kind":"primary"}],"confidence":0.95}}\n\n',
    ].join("");
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(streamBody));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));
    apiRequestMock.mockClear();

    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));
    const input = await screen.findByPlaceholderText(/ask suki assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/open customers\./i)).toBeInTheDocument();
    expect(apiRequestMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/help\/assistant\/chat$/),
      expect.anything(),
    );
  });

  it("falls back to /chat only when stream transport fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, body: null }));
    apiRequestMock.mockClear();

    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));
    const input = await screen.findByPlaceholderText(/ask suki assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/help/assistant/chat",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText(/add customers from the customers page\./i)).toBeInTheDocument();
  });

  it("renders action chips from orchestrated response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, body: null }));
    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));

    const input = await screen.findByPlaceholderText(/ask suki assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /add customer now/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /show details/i })).toBeInTheDocument();
  });

  it("shows streaming state and final assistant response from SSE endpoint", async () => {
    const streamBody = [
      'event: meta\ndata: {"type":"meta","threadId":"thread-1","intent":"how_to"}\n\n',
      'event: state\ndata: {"type":"state","state":"streaming"}\n\n',
      'event: delta\ndata: {"type":"delta","chunk":"Open Customers. "}\n\n',
      'event: delta\ndata: {"type":"delta","chunk":"Tap Add customer now."}\n\n',
      'event: done\ndata: {"type":"done","response":{"threadId":"thread-1","plainAnswer":"Open Customers.","nextStep":"Tap Add customer now.","actionChips":[{"label":"Add customer now","href":"/customers","kind":"primary"}],"confidence":0.95}}\n\n',
    ].join("");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(streamBody));
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      }),
    );
    apiRequestMock.mockClear();

    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));

    const input = await screen.findByPlaceholderText(/ask suki assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/status:\s*read/i)).toBeInTheDocument();
    expect(await screen.findByText(/open customers\./i)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /add customer now/i })).toBeInTheDocument();
    expect(apiRequestMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/help\/assistant\/chat$/),
      expect.anything(),
    );
  });

  it("omits placeholder bearer token from stream headers (cookie-first auth)", async () => {
    const streamBody = [
      'event: meta\ndata: {"type":"meta","threadId":"thread-1","intent":"how_to"}\n\n',
      'event: done\ndata: {"type":"done","response":{"threadId":"thread-1","plainAnswer":"Open Customers.","nextStep":"Tap Add customer now.","actionChips":[{"label":"Add customer now","href":"/customers","kind":"primary"}],"confidence":0.95}}\n\n',
    ].join("");
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(streamBody));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, body: stream });
    vi.stubGlobal("fetch", fetchMock);

    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));
    const input = await screen.findByPlaceholderText(/ask suki assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText(/open customers\./i);
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});
