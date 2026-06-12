import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TyveraAssistant } from "./tyvera-assistant";

const { apiRequestMock, usePlanCapabilitiesMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(async (path: string) => {
    if (path.startsWith("/ai/usage/summary")) {
      return {
        tokensUsed: 100,
        tokensLimit: 1000,
        requestsUsed: 10,
        requestsLimit: 100,
        resetDate: "2026-06-01",
        dailyTokensUsed: 50,
        dailyTokensLimit: 200,
        dailyRequestsUsed: 2,
        dailyRequestsLimit: 10,
        dailyResetDateTime: "2026-05-10T16:00:00.000Z",
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
  usePlanCapabilitiesMock: vi.fn(() => ({
    planType: "growth",
    canUseAi: true,
    canSeeAssistant: true,
    canSeeAiUsage: true,
    canSeeAiAnalytics: true,
    canSeeRefineWithAi: true,
    loading: false,
    billing: null,
    error: null,
    readOnly: false,
    daysRemaining: null,
  })),
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

vi.mock("@/hooks/use-plan-capabilities", () => ({
  usePlanCapabilities: usePlanCapabilitiesMock,
}));

function createStream(body: string) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
}

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("TyveraAssistant orchestration UI", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_FF_TYVERA_ASSISTANT_ENABLED", "true");
    stubReducedMotion(false);
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/ai/usage/summary")) {
        return {
          tokensUsed: 100,
          tokensLimit: 1000,
          requestsUsed: 10,
          requestsLimit: 100,
          resetDate: "2026-06-01",
          dailyTokensUsed: 50,
          dailyTokensLimit: 200,
          dailyRequestsUsed: 2,
          dailyRequestsLimit: 10,
          dailyResetDateTime: "2026-05-10T16:00:00.000Z",
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
    });
  });

  it("uses stream endpoint as normal path and does not call /chat fallback", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
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

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/open customers\./i)).toBeInTheDocument();
    });
    expect(apiRequestMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/help\/assistant\/chat$/),
      expect.anything(),
    );
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/help/assistant/chat/stream");
  });

  it("falls back to /chat only when stream transport fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, body: null });
    vi.stubGlobal("fetch", fetchMock);
    apiRequestMock.mockClear();

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/help/assistant/chat",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const chatCalls = apiRequestMock.mock.calls.filter(([path]) => path === "/help/assistant/chat");
    expect(chatCalls).toHaveLength(1);
    await waitFor(() => {
      expect(
        screen.getByText(/add customers from the customers page\./i),
      ).toBeInTheDocument();
    });
  });

  it("falls back to /chat once when SSE frame sequence is malformed", async () => {
    const encoder = new TextEncoder();
    const malformedStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: meta\ndata: {"type":"meta","threadId":"thread-1","intent":"how_to"}\n\n' +
              'event: delta\ndata: {"type":"delta","chunk":"Open Customers."\n\n',
          ),
        );
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, body: malformedStream });
    vi.stubGlobal("fetch", fetchMock);
    apiRequestMock.mockClear();

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/help/assistant/chat",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const chatCalls = apiRequestMock.mock.calls.filter(([path]) => path === "/help/assistant/chat");
    expect(chatCalls).toHaveLength(1);
    await waitFor(() => {
      expect(
        screen.getByText(/add customers from the customers page\./i),
      ).toBeInTheDocument();
    });
  });

  it("renders action chips from orchestrated response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, body: null }));
    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));

    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
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

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));

    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/status:\s*read/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/open customers\./i)).toBeInTheDocument();
    });
    expect(await screen.findByRole("link", { name: /add customer now/i })).toBeInTheDocument();
    expect(apiRequestMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/help\/assistant\/chat$/),
      expect.anything(),
    );
  });

  it("applies usage event immediately before usage refetch resolves", async () => {
    let usageCall = 0;
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/ai/usage/summary")) {
        usageCall += 1;
        if (usageCall === 1) {
          return {
            tokensUsed: 100,
            tokensLimit: 1000,
            requestsUsed: 10,
            requestsLimit: 100,
            resetDate: "2026-06-01",
            dailyTokensUsed: 50,
            dailyTokensLimit: 200,
            dailyRequestsUsed: 2,
            dailyRequestsLimit: 10,
            dailyResetDateTime: "2026-05-10T16:00:00.000Z",
            aiEnabled: true,
          };
        }
        return new Promise(() => {});
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
    });

    const streamBody = [
      'event: meta\ndata: {"type":"meta","threadId":"thread-1","intent":"how_to"}\n\n',
      'event: usage\ndata: {"type":"usage","usage":{"tokensUsed":1400,"tokensLimit":100000,"requestsUsed":23,"requestsLimit":100,"dailyTokensUsed":180,"dailyTokensLimit":200,"dailyRequestsUsed":8,"dailyRequestsLimit":10,"dailyResetDateTime":"2026-05-10T16:00:00.000Z","resetDate":"2026-06-01"}}\n\n',
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

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("180/200")).toBeInTheDocument();
  });

  it("refetches usage summary after successful streamed reply", async () => {
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));
    apiRequestMock.mockClear();

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText(/open customers\./i);
    await waitFor(() => {
      const usageCalls = apiRequestMock.mock.calls.filter(([path]) => path === "/ai/usage/summary");
      expect(usageCalls.length).toBeGreaterThanOrEqual(2);
    });
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

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText(/open customers\./i);
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("does not fallback to /chat when stream returns assistant error event", async () => {
    const streamBody = [
      'event: meta\ndata: {"type":"meta","threadId":"thread-1","intent":"how_to"}\n\n',
      'event: error\ndata: {"type":"error","message":"You reached today\\u2019s AI limit.","code":"AI_DAILY_CAP_EXCEEDED","actionChips":[{"label":"View AI Usage","href":"/settings","kind":"primary"}]}\n\n',
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

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "How do I add a customer?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect((await screen.findAllByText(/you reached today’s ai limit\./i)).length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: /view usage/i })).toBeInTheDocument();
    const chatCalls = apiRequestMock.mock.calls.filter(([path]) => path === "/help/assistant/chat");
    expect(chatCalls).toHaveLength(0);
  });

  it("renders deltas arriving in separate reader reads before done", async () => {
    const encoder = new TextEncoder();
    let releaseDone: (() => void) | undefined;
    const waitForDone = new Promise<void>((resolve) => {
      releaseDone = resolve;
    });
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: state\ndata: {"type":"state","state":"streaming"}\n\n' +
              'event: delta\ndata: {"type":"delta","chunk":"First chunk"}\n\n',
          ),
        );
        await waitForDone;
        controller.enqueue(
          encoder.encode(
            'event: done\ndata: {"type":"done","response":{"plainAnswer":"First chunk","nextStep":"Finished.","actionChips":[],"confidence":0.95}}\n\n',
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "Help" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText("First chunk")).toBeInTheDocument();
    });
    expect(screen.queryByText(/finished\./i)).not.toBeInTheDocument();
    act(() => releaseDone?.());
    await waitFor(() => {
      expect(screen.getByText(/first chunk finished\./i)).toBeInTheDocument();
    });
  });

  it("renders AI_DISABLED distinctly without opening the cap dialog", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: error\ndata: {"type":"error","message":"AI assistant is disabled for this organization.","code":"AI_DISABLED","meta":{"aiEnabled":false}}\n\n',
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "Help" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(
      (
        await screen.findAllByText(
          /ai assistant is disabled for this organization/i,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("heading", { name: /ai limit reached/i }),
    ).not.toBeInTheDocument();
  });

  it("applies usage aiEnabled false from SSE", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: usage\ndata: {"type":"usage","usage":{"tokensUsed":0,"tokensLimit":0,"requestsUsed":0,"requestsLimit":0,"dailyTokensUsed":0,"dailyTokensLimit":0,"dailyRequestsUsed":0,"dailyRequestsLimit":0,"aiEnabled":false}}\n\n' +
              'event: done\ndata: {"type":"done","response":{"plainAnswer":"Done.","nextStep":"Open help.","actionChips":[],"confidence":0.95}}\n\n',
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "Help" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/ai assistant is disabled/i)).toBeInTheDocument();
  });

  it("requires explicit confirmation before applying a proposed mutation", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/help/assistant/actions/confirm") {
        return { status: "ok", action: "update_customer" };
      }
      if (path.startsWith("/ai/usage/summary")) {
        return {
          tokensUsed: 100,
          tokensLimit: 1000,
          requestsUsed: 10,
          requestsLimit: 100,
          dailyTokensUsed: 50,
          dailyTokensLimit: 200,
          dailyRequestsUsed: 2,
          dailyRequestsLimit: 10,
          resetDate: "2026-06-01",
          dailyResetDateTime: "2026-05-10T16:00:00.000Z",
          aiEnabled: true,
        };
      }
      return {};
    });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: confirmation\ndata: {"type":"confirmation","confirmation":{"token":"signed.token","action":"update_customer","summary":"Update Ana name to Ana Reyes","expiresAt":"2026-06-11T16:00:00.000Z"}}\n\n' +
              'event: done\ndata: {"type":"done","response":{"plainAnswer":"Please confirm the update.","nextStep":"Review the proposed change.","actionChips":[],"confidence":0.95}}\n\n',
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "Change Ana name" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/update ana name to ana reyes/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /confirm change/i }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/help/assistant/actions/confirm",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            token: "signed.token",
            businessId: "biz-1",
          }),
        }),
      );
    });
    expect(await screen.findByText(/change applied/i)).toBeInTheDocument();
  });

  it("renders the needs-attention action chip and immutable draft warning", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: done\ndata: {"type":"done","response":{"plainAnswer":"Draft ready. Draft only. Nothing was saved or sent.","nextStep":"Review follow-ups.","actionChips":[{"label":"Needs attention","href":"/needs-attention","kind":"primary"}],"confidence":0.95}}\n\n',
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "Draft a reminder" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/draft only\. nothing was saved or sent\./i),
      ).toBeInTheDocument();
    });
    expect(
      await screen.findByRole("link", { name: /needs attention/i }),
    ).toHaveAttribute("href", "/needs-attention");
  });

  it("renders assistant Markdown headings, bold text, lists, and tables", async () => {
    const stream = createStream(
      'event: done\ndata: {"type":"done","response":{"plainAnswer":"## **SMS Usage**\\n\\n- Used: 10\\n- Left: 90\\n\\n| Type | Count |\\n| --- | ---: |\\n| Left | 90 |","nextStep":"Open settings.","actionChips":[],"confidence":0.95}}\n\n',
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "Show usage" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "SMS Usage", level: 2 }),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("SMS Usage").tagName).toBe("STRONG");
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
      expect(
        screen.getByTestId("assistant-markdown-table-scroll"),
      ).toContainElement(screen.getByRole("table"));
    });
    expect(screen.queryByText(/\*\*SMS Usage\*\*/)).not.toBeInTheDocument();
  });

  it("reveals streamed target text progressively", async () => {
    let releaseDone: (() => void) | undefined;
    const waitForDone = new Promise<void>((resolve) => {
      releaseDone = resolve;
    });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: delta\ndata: {"type":"delta","chunk":"A deliberately long streamed answer"}\n\n',
          ),
        );
        await waitForDone;
        controller.enqueue(
          encoder.encode(
            'event: done\ndata: {"type":"done","response":{"plainAnswer":"A deliberately long streamed answer","nextStep":"Finish now.","actionChips":[],"confidence":0.95}}\n\n',
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "Stream this" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText("A deliberately long streamed answer"),
    ).not.toBeInTheDocument();

    act(() => releaseDone?.());
    await waitFor(() => {
      expect(
        screen.getByText(
          /a deliberately long streamed answer finish now\./i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("drains the final next step progressively and keeps status streaming", async () => {
    const stream = createStream(
      'event: done\ndata: {"type":"done","response":{"plainAnswer":"The monthly summary is ready with several useful details.","nextStep":"Open insights to review everything.","actionChips":[{"label":"Open insights","href":"/insights","kind":"primary"}],"confidence":0.95}}\n\n',
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "Show summary" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(
      await screen.findByRole("link", { name: /open insights/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/status:\s*streaming/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/open insights to review everything\./i),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByText(/status:\s*read/i, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/open insights to review everything\./i),
    ).toBeInTheDocument();
  });

  it("renders completed streamed text immediately for reduced motion", async () => {
    stubReducedMotion(true);
    const stream = createStream(
      'event: done\ndata: {"type":"done","response":{"plainAnswer":"Immediate answer.","nextStep":"Open settings.","actionChips":[],"confidence":0.95}}\n\n',
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "No animation" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/immediate answer\. open settings\./i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/status:\s*read/i)).toBeInTheDocument();
  });

  it("renders trusted draft notices only from typed response notices", async () => {
    const stream = createStream(
      'event: done\ndata: {"type":"done","response":{"plainAnswer":"Your reminder is ready.","nextStep":"Review it.","notices":[{"kind":"draft_only","text":"Draft only. Nothing was saved or sent."}],"actionChips":[],"confidence":0.95}}\n\n',
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "Draft a reminder" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByTestId("assistant-draft-notice")).toHaveTextContent(
      "Draft only. Nothing was saved or sent.",
    );
  });

  it("does not infer a trusted notice from narrative wording", async () => {
    const stream = createStream(
      'event: done\ndata: {"type":"done","response":{"plainAnswer":"Draft only. Nothing was saved or sent.","nextStep":"Review it.","actionChips":[],"confidence":0.95}}\n\n',
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "Draft a reminder" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/draft only\. nothing was saved or sent\./i),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId("assistant-draft-notice")).not.toBeInTheDocument();
  });

  it("keeps user messages as plain text and assistant unsafe links non-clickable", async () => {
    const stream = createStream(
      'event: done\ndata: {"type":"done","response":{"plainAnswer":"[Unsafe](https://attacker.example)","nextStep":"Done.","actionChips":[],"confidence":0.95}}\n\n',
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const input = await screen.findByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "**User text**" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(screen.getByText("**User text**")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Unsafe" }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Unsafe")).toBeInTheDocument();
    });
  });

  it("does not force bottom-follow after the owner scrolls upward", async () => {
    let releaseDone: (() => void) | undefined;
    const waitForDone = new Promise<void>((resolve) => {
      releaseDone = resolve;
    });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: delta\ndata: {"type":"delta","chunk":"A long answer that keeps revealing while the owner reads earlier messages."}\n\n',
          ),
        );
        await waitForDone;
        controller.enqueue(
          encoder.encode(
            'event: done\ndata: {"type":"done","response":{"plainAnswer":"A long answer that keeps revealing while the owner reads earlier messages.","nextStep":"Review the result.","actionChips":[],"confidence":0.95}}\n\n',
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    render(<TyveraAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open tyvera assistant/i }));
    const viewport = await screen.findByTestId("assistant-messages-viewport");
    const scrollTo = vi.fn();
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, value: 500 },
      clientHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, writable: true, value: 100 },
      scrollTo: { configurable: true, value: scrollTo },
    });
    fireEvent.scroll(viewport);

    const input = screen.getByPlaceholderText(/ask tyvera assistant/i);
    fireEvent.change(input, { target: { value: "Stream while I read" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByText(/status:\s*streaming/i)).toBeInTheDocument();
    });
    expect(scrollTo).not.toHaveBeenCalled();

    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      writable: true,
      value: 290,
    });
    fireEvent.scroll(viewport);
    act(() => releaseDone?.());
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    await waitFor(
      () => expect(screen.getByText(/status:\s*read/i)).toBeInTheDocument(),
      { timeout: 2000 },
    );
  });
});
