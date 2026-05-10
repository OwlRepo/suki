"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { buildUsageModel, type AiUsageSummary } from "@/lib/assistant-usage";
import { searchHelpContent } from "@/lib/help-content";

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  state?: "sending" | "streaming" | "sent" | "read" | "error";
  sources?: string[];
  details?: string;
  actionChips?: Array<{ label: string; href: string; kind: "primary" | "secondary" }>;
};

const PROMPTS = [
  "How do I add a customer?",
  "What's my sales this month?",
  "How many SMS do I have left?",
];

const COACHMARK_KEY = "suki-assistant-coachmark-dismissed-v1";
const ASSISTANT_HEADER_COLLAPSED_KEY = "suki-assistant-header-collapsed-v1";
const COACHMARK_STEPS = [
  "Ask Suki Assistant how to do tasks in simple language.",
  "Check today’s AI usage and daily reset time before you run out.",
  "Use Help Center and Settings shortcuts when you need more details.",
];

function usageBarClass(state: "normal" | "warning" | "capped") {
  if (state === "capped") return "bg-red-500";
  if (state === "warning") return "bg-amber-500";
  return "bg-emerald-500";
}

function detectLocale(query: string): "en" | "tl" {
  const q = query.toLowerCase();
  if (q.includes("paano") || q.includes("ilan") || q.includes("natitira")) return "tl";
  return "en";
}

function isUsableBearerToken(token: string | null | undefined): token is string {
  if (!token) return false;
  const value = token.trim();
  if (!value) return false;
  if (value.toLowerCase() === "cookie-session") return false;
  return true;
}

export function SukiAssistant() {
  const { getToken } = useAuth();
  const workspace = useWorkspace();
  const [open, setOpen] = useState(false);
  const [showCoachmark, setShowCoachmark] = useState(false);
  const [coachmarkStep, setCoachmarkStep] = useState(0);
  const [showAskGuide, setShowAskGuide] = useState(false);
  const [showCapDialog, setShowCapDialog] = useState(false);
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi, I’m Suki Assistant. I can help you navigate the app and check your usage.",
      sources: ["Help Center"],
    },
  ]);
  const [input, setInput] = useState("");
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [threadId, setThreadId] = useState<string>("");
  const [assistantState, setAssistantState] = useState<AssistantMessage["state"]>("read");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  useEffect(() => {
    const id = `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setThreadId(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storage = window.localStorage;
    const dismissed = storage && typeof storage.getItem === "function"
      ? storage.getItem(COACHMARK_KEY) === "1"
      : true;
    if (!dismissed) setShowCoachmark(true);
    setHeaderCollapsed(window.sessionStorage.getItem(ASSISTANT_HEADER_COLLAPSED_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const token = await getToken();
      try {
        const summary = await apiRequest<AiUsageSummary>("/ai/usage/summary", {
          token: isUsableBearerToken(token) ? token : undefined,
        });
        setUsage(summary);
      } catch {
        setUsage(null);
      }
    })();
  }, [open, getToken]);

  const usageModel = useMemo(
    () =>
      buildUsageModel(
        usage ?? {
          tokensUsed: 0,
          tokensLimit: 0,
          requestsUsed: 0,
          requestsLimit: 0,
          dailyTokensUsed: 0,
          dailyTokensLimit: 0,
          dailyRequestsUsed: 0,
          dailyRequestsLimit: 0,
          aiEnabled: true,
        },
      ),
    [usage],
  );

  const dismissCoachmark = () => {
    setShowCoachmark(false);
    if (typeof window !== "undefined") {
      const storage = window.localStorage;
      if (storage && typeof storage.setItem === "function") {
        storage.setItem(COACHMARK_KEY, "1");
      }
    }
  };

  const nextCoachmark = () => {
    setCoachmarkStep((prev) => {
      if (prev >= COACHMARK_STEPS.length - 1) {
        dismissCoachmark();
        return prev;
      }
      return prev + 1;
    });
  };

  const answerQuery = async (query: string): Promise<AssistantMessage> => {
    const token = await getToken();

    try {
      const res = await apiRequest<{
        threadId?: string;
        plainAnswer: string;
        nextStep: string;
        details?: string;
        fallback?: { reason?: string };
        actionChips?: Array<{ label: string; href: string; kind: "primary" | "secondary" }>;
      }>("/help/assistant/chat", {
        method: "POST",
        token: isUsableBearerToken(token) ? token : undefined,
        body: JSON.stringify({
          message: query,
          businessId: workspace?.activeBusinessId ?? undefined,
          threadId: threadId || undefined,
        }),
      });
      if (res.threadId) setThreadId(res.threadId);
      if (res.fallback?.reason === "capped") {
        setShowCapDialog(true);
      }
      return {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: `${res.plainAnswer} ${res.nextStep}`.trim(),
        details: res.details,
        actionChips: res.actionChips ?? [],
        sources: ["Suki Assistant"],
      };
    } catch {
      // Fallback to local docs search below.
    }

    const locale = detectLocale(query);
    const docs = searchHelpContent(query, locale);
    if (docs.length > 0) {
      return {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: `${docs[0].quickAnswer} ${locale === "tl" ? "Pindutin ang button sa ibaba para magpatuloy." : "Use the action buttons below to continue."}`,
        sources: docs[0].relatedRoutes,
        actionChips: docs[0].relatedRoutes.slice(0, 2).map((href, idx) => ({
          label: idx === 0 ? "Do this now" : "See details",
          href,
          kind: idx === 0 ? "primary" : "secondary",
        })),
      };
    }

    return {
      id: `a-${Date.now()}`,
      role: "assistant",
      text: "I can’t find that in current app sources. Try Help Center or open Settings for usage details.",
      sources: ["Help Center", "/settings", "/help"],
      actionChips: [
        { label: "Open Help Center", href: "/help", kind: "primary" },
        { label: "View AI Usage", href: "/settings", kind: "secondary" },
      ],
    };
  };

  const streamAnswerQuery = async (query: string): Promise<boolean> => {
    const token = await getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isUsableBearerToken(token)) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/help/assistant/chat/stream`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({
        message: query,
        businessId: workspace?.activeBusinessId ?? undefined,
        threadId: threadId || undefined,
      }),
    });

    if (!response.ok || !response.body) return false;

    const messageId = `a-${Date.now()}`;
    let text = "";
    let details: string | undefined;
    let actionChips: AssistantMessage["actionChips"] = [];
    let sawDoneEvent = false;
    let hadProtocolError = false;
    let sawErrorEvent = false;
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = "";

    setMessages((prev) => [...prev, { id: messageId, role: "assistant", text: "", state: "streaming" }]);
    setAssistantState("streaming");

    const applyEvent = (eventType: string, payload: Record<string, unknown>) => {
      if (eventType === "meta" && typeof payload.threadId === "string") {
        setThreadId(payload.threadId);
      }
      if (eventType === "state" && typeof payload.state === "string") {
        setAssistantState(payload.state as AssistantMessage["state"]);
        setMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? { ...msg, state: payload.state as AssistantMessage["state"] } : msg)),
        );
      }
      if (eventType === "delta" && typeof payload.chunk === "string") {
        text += payload.chunk;
        setMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? { ...msg, text, state: "streaming" } : msg)),
        );
      }
      if (eventType === "actions" && Array.isArray(payload.actionChips)) {
        actionChips = payload.actionChips as AssistantMessage["actionChips"];
      }
      if (eventType === "done" && payload.response && typeof payload.response === "object") {
        sawDoneEvent = true;
        const finalResponse = payload.response as {
          plainAnswer: string;
          nextStep: string;
          details?: string;
          actionChips?: AssistantMessage["actionChips"];
        };
        details = finalResponse.details;
        actionChips = finalResponse.actionChips ?? actionChips;
        const finalText = `${finalResponse.plainAnswer} ${finalResponse.nextStep}`.trim();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, text: finalText || text, details, actionChips, sources: ["Suki Assistant"], state: "read" }
              : msg,
          ),
        );
        setAssistantState("read");
      }
      if (eventType === "error") {
        sawErrorEvent = true;
        const errorPayload = payload as {
          message?: string;
          code?: string;
          actionChips?: AssistantMessage["actionChips"];
        };
        const isCapError = typeof errorPayload.code === "string" && errorPayload.code.includes("CAP");
        if (isCapError) {
          setShowCapDialog(true);
        }
        setAssistantState("error");
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  text: text || errorPayload.message || "I hit a connection issue. Please try again.",
                  state: "error",
                  actionChips: errorPayload.actionChips ?? [
                    { label: "Retry", href: "#", kind: "primary" },
                    { label: "Open Help Center", href: "/help", kind: "secondary" },
                  ],
                }
              : msg,
          ),
        );
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const lines = frame.split("\n");
        const eventType = lines.find((line) => line.startsWith("event:"))?.replace("event:", "").trim();
        const dataLine = lines.find((line) => line.startsWith("data:"))?.replace("data:", "").trim();
        if (!eventType || !dataLine) continue;
        try {
          const payload = JSON.parse(dataLine) as Record<string, unknown>;
          applyEvent(eventType, payload);
        } catch {
          hadProtocolError = true;
        }
      }
    }

    // SSE transport/protocol failures should fallback to /chat.
    // Stream-level assistant "error" events are valid terminal events and should not fallback.
    if (sawErrorEvent) {
      return true;
    }

    if (!sawDoneEvent || hadProtocolError) {
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
      return false;
    }

    return true;
  };

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (usageModel.capped) {
      setShowCapDialog(true);
      return;
    }
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: trimmed, state: "sending" }]);
    setInput("");
    setAssistantState("sending");
    const streamed = await streamAnswerQuery(trimmed).catch(() => false);
    if (streamed) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.role === "user" && msg.state === "sending" ? { ...msg, state: "sent" as const } : msg,
        ),
      );
      return;
    }
    const reply = await answerQuery(trimmed);
    setMessages((prev) => [
      ...prev.map((msg) =>
        msg.role === "user" && msg.state === "sending" ? { ...msg, state: "sent" as const } : msg,
      ),
      { ...reply, state: "read" },
    ]);
    setAssistantState("read");
  };

  return (
    <>
      <div className="fixed right-4 bottom-24 z-40 lg:bottom-6">
        {showCoachmark && (
          <Card className="mb-3 w-80 border-primary/30 bg-card/95 shadow-xl backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200 motion-reduce:animate-none">
            <CardContent className="space-y-3 p-5">
              <p className="text-base font-semibold tracking-tight">Try Suki Assistant</p>
              <p className="text-sm leading-relaxed text-muted-foreground">Step {coachmarkStep + 1} of {COACHMARK_STEPS.length}: {COACHMARK_STEPS[coachmarkStep]}</p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="min-h-[42px] px-4 text-sm" onClick={() => { setOpen(true); dismissCoachmark(); }}>Open now</Button>
                <Button size="sm" variant="outline" onClick={nextCoachmark}>
                  {coachmarkStep >= COACHMARK_STEPS.length - 1 ? "Done" : "Next"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <Button
          aria-label="Open Suki Assistant"
          className="min-h-[54px] rounded-full border border-primary/20 bg-primary px-6 text-base font-medium shadow-xl shadow-primary/20 transition-transform duration-200 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] motion-reduce:transform-none"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="mr-2 size-5" aria-hidden />
          Suki Assistant
        </Button>
      </div>

      {open && (
        <section
          aria-label="Suki Assistant Panel"
          className="fixed right-0 bottom-0 z-50 flex h-[84vh] w-full max-w-[26rem] flex-col border-l border-border/80 bg-background shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-200 motion-reduce:animate-none"
        >
          <div className="border-b border-border/80 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold tracking-tight">Suki Assistant</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-[40px] px-3"
                  aria-label={headerCollapsed ? "Expand assistant header" : "Collapse assistant header"}
                  onClick={() => {
                    const next = !headerCollapsed;
                    setHeaderCollapsed(next);
                    if (typeof window !== "undefined") {
                      window.sessionStorage.setItem(ASSISTANT_HEADER_COLLAPSED_KEY, next ? "1" : "0");
                    }
                  }}
                >
                  {headerCollapsed ? "Expand" : "Collapse"}
                </Button>
                <Button size="sm" variant="outline" className="min-h-[40px] px-3" onClick={() => setOpen(false)}>Close</Button>
              </div>
            </div>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Status: {assistantState === "read" ? "Read" : assistantState === "sent" ? "Sent" : assistantState === "streaming" ? "Streaming" : assistantState === "sending" ? "Sending" : "Error"}
            </p>

            {headerCollapsed ? (
              <div className="mt-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Daily AI limit: {usageModel.daily.messages.used}/{usageModel.daily.messages.limit} messages, {usageModel.daily.tokens.used}/{usageModel.daily.tokens.limit} credits. {usageModel.dailyResetLabel}.
              </div>
            ) : (
              <div className="mt-3 space-y-2.5 rounded-xl border border-border/80 bg-muted/35 p-3">
                <p className="text-sm font-semibold tracking-tight">AI Usage Snapshot</p>
                <p className="text-xs leading-relaxed text-muted-foreground">Daily reset: {usageModel.dailyResetLabel}</p>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span>Daily AI message limit</span>
                    <span>{usageModel.daily.messages.used}/{usageModel.daily.messages.limit}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted">
                    <div
                      className={cn("h-2.5 rounded-full transition-all duration-300", usageBarClass(usageModel.daily.messages.state))}
                      style={{ width: `${Math.min(100, Math.round(usageModel.daily.messages.pct * 100))}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Daily remaining: {usageModel.daily.messages.remaining}</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span>Daily AI credits limit</span>
                    <span>{usageModel.daily.tokens.used}/{usageModel.daily.tokens.limit}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted">
                    <div
                      className={cn("h-2.5 rounded-full transition-all duration-300", usageBarClass(usageModel.daily.tokens.state))}
                      style={{ width: `${Math.min(100, Math.round(usageModel.daily.tokens.pct * 100))}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Daily remaining: {usageModel.daily.tokens.remaining}</p>
                </div>

                <div className="space-y-1.5 border-t border-border/70 pt-2">
                  <p className="text-xs font-semibold text-muted-foreground">This month</p>
                  <p className="text-xs text-muted-foreground">
                    Messages: {usageModel.messages.used}/{usageModel.messages.limit} • AI credits: {usageModel.tokens.used}/{usageModel.tokens.limit}
                  </p>
                  <p className="text-xs text-muted-foreground">{usageModel.resetLabel}</p>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/help" className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted">Open Help Center</Link>
              <Link href="/settings" className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted">View AI Usage</Link>
              <Button size="sm" variant="ghost" className="min-h-[40px] px-3 text-xs font-medium" onClick={() => setShowAskGuide((v) => !v)}>What can I ask?</Button>
            </div>

            {showAskGuide && (
              <div className="mt-2 rounded-lg border border-border/80 bg-background p-3 text-xs leading-relaxed motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150 motion-reduce:animate-none">
                <p className="font-semibold">Daily tasks</p>
                <p className="text-muted-foreground">Ask how to add customers, record visits, and schedule appointments.</p>
                <p className="mt-2 font-semibold">Billing and usage</p>
                <p className="text-muted-foreground">Ask about AI usage, SMS remaining, and monthly summary.</p>
              </div>
            )}

            {usageModel.capped && (
              <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700">
                Daily AI limit reached for now. Check daily reset and usage details below.
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
            {messages.map((message) => (
              <div key={message.id} className={cn("max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm", message.role === "user" ? "ml-auto border border-primary/20 bg-primary text-primary-foreground" : "border border-border/70 bg-muted/90 text-foreground")}>
                {message.state && (
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-85">
                    {message.state}
                  </p>
                )}
                <p className="font-normal">{message.text}</p>
                {!!message.actionChips?.length && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {message.actionChips.map((chip) => (
                      <Link
                        key={`${message.id}-${chip.label}-${chip.href}`}
                        href={chip.href}
                        className={cn(
                          "min-h-[44px] rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                          chip.kind === "primary"
                            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                            : "border-border/80 bg-background/80 hover:bg-muted",
                        )}
                      >
                        {chip.label}
                      </Link>
                    ))}
                  </div>
                )}
                {message.details && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-[40px] px-2 text-xs"
                      onClick={() =>
                        setExpandedDetails((prev) => ({
                          ...prev,
                          [message.id]: !prev[message.id],
                        }))
                      }
                    >
                      Show details
                    </Button>
                    {expandedDetails[message.id] && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {message.details}
                      </p>
                    )}
                  </div>
                )}
                {!!message.sources?.length && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.sources.map((src) => (
                      <span key={src} className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] font-medium">{src}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border/80 p-3.5">
            <div data-testid="assistant-prompt-row" className="mb-2.5 flex flex-nowrap gap-2 overflow-x-auto pb-1">
              {PROMPTS.map((prompt) => (
                <Button key={prompt} type="button" size="sm" variant="outline" onClick={() => submit(prompt)} className="min-h-[40px] shrink-0 rounded-full border-border/80 bg-background text-xs font-medium transition-colors hover:bg-muted">
                  <Sparkles className="mr-1 size-3" aria-hidden />
                  {prompt}
                </Button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(input);
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Suki Assistant..."
                className="min-h-[48px] rounded-xl border-border/80 text-base"
              />
              <Button type="submit" className="min-h-[48px] rounded-xl px-4 text-sm font-semibold">Send</Button>
            </form>
          </div>
        </section>
      )}

      <Dialog open={showCapDialog} onOpenChange={setShowCapDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="tracking-tight">AI limit reached</DialogTitle>
            <DialogDescription>
              You reached today’s AI limit. {usageModel.dailyResetLabel}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm leading-relaxed">
            <p>Reason: your daily AI message or daily AI credits limit is at cap.</p>
            <p>Next steps: review daily usage, continue with Help Center guides, or upgrade for higher limits.</p>
          </div>
          <DialogFooter showCloseButton>
            <Link href="/settings" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">View usage</Link>
            <Link href="/help" className="rounded-md border px-4 py-2 text-sm">Open Help Center</Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
