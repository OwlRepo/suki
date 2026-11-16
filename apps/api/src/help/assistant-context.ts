import path from "node:path";
import {
  loadAssistantContextEntries,
  type AssistantContextEntry,
} from "./assistant-context-loader";

export type AssistantIntent = "usage" | "metrics" | "how_to" | "troubleshooting" | "general";

const MASTER_APP_CONTEXT = {
  product: "Suki",
  audience: "Non-technical small business users",
  tone: "Simple, plain-language, action-first",
  guardrails: [
    "Use only trusted provided app context and tool outputs.",
    "Do not invent metrics, limits, or routes.",
    "Return short actionable answers with one clear next step.",
  ],
  routeMap: {
    dashboard: "/dashboard",
    customers: "/customers",
    appointments: "/appointments",
    insights: "/insights",
    analytics: "/analytics",
    settings: "/settings",
    help: "/help",
    onboarding: "/onboarding",
  },
} as const;

const TOOL_DESCRIPTORS = [
  { name: "get_business_summary", when: "monthly metrics and sales summary questions", intents: ["metrics"] },
  { name: "get_sms_usage", when: "SMS credits and remaining usage questions", intents: ["usage"] },
  { name: "get_billing_status", when: "plan and billing status questions", intents: ["usage"] },
  { name: "get_ai_usage", when: "AI usage and limits questions", intents: ["usage"] },
  { name: "route_guidance", when: "navigation and where-to-click questions", intents: ["how_to", "general", "troubleshooting"] },
] as const;

function trimText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 3)}...`;
}

function detectDocRootFromCwd(): string {
  const cwd = process.cwd();
  // Works for monorepo root and apps/api cwd.
  if (cwd.endsWith(path.join("apps", "api"))) {
    return path.resolve(cwd, "../..");
  }
  return cwd;
}

function toIntent(entry: AssistantContextEntry): AssistantIntent {
  if (entry.category === "usage") return "usage";
  if (entry.category === "metrics") return "metrics";
  if (entry.category === "troubleshooting") return "troubleshooting";
  if (entry.category === "customers" || entry.category === "appointments" || entry.category === "onboarding") return "how_to";
  return "general";
}

function scoreEntryForQuery(entry: AssistantContextEntry, query: string): number {
  const q = query.toLowerCase();
  if (!q) return 0;
  let score = 0;
  for (const intent of entry.intents) {
    if (q.includes(intent.toLowerCase())) score += 6;
  }
  for (const route of entry.relatedRoutes) {
    const routeName = route.replace(/^\//, "").toLowerCase();
    if (q.includes(routeName)) score += 8;
    if (routeName.includes("share-slots") && (q.includes("slot") || q.includes("share"))) score += 8;
    if (routeName.includes("promos") && (q.includes("promo") || q.includes("campaign"))) score += 8;
    if (routeName.includes("pipeline") && (q.includes("pipeline") || q.includes("deal"))) score += 8;
  }
  return score;
}

function topHelpArticles(locale: "en" | "tl", intent: AssistantIntent, query: string): AssistantContextEntry[] {
  const rootDir = detectDocRootFromCwd();
  const all = loadAssistantContextEntries(rootDir).filter((entry) => entry.locale === locale);

  const exact = all.filter((entry) => toIntent(entry) === intent);
  const fallback = all.filter((entry) => toIntent(entry) === "general" || entry.category === "policies");
  const merged = [...exact, ...fallback];
  merged.sort((a, b) => {
    const score = (p: string) => (p === "high" ? 3 : p === "medium" ? 2 : 1);
    const queryScore = scoreEntryForQuery(b, query) - scoreEntryForQuery(a, query);
    if (queryScore !== 0) return queryScore;
    return score(b.priority) - score(a.priority);
  });
  return merged.slice(0, 8);
}

export function buildAssistantContextPack(input: {
  intent: AssistantIntent;
  locale: "en" | "tl";
  query?: string;
  memory: { summary: string; turns: Array<{ role: "user" | "assistant"; text: string }> };
  dataContext: Record<string, unknown>;
}) {
  const helpArticles = topHelpArticles(input.locale, input.intent, input.query ?? "").map((a) => ({
    source: "docs/assistant-context",
    title: a.id,
    quickAnswer: a.quickAnswer,
    routes: a.relatedRoutes,
    intents: a.intents,
    priority: a.priority,
    steps: a.steps,
    toolBindings: a.toolBindings,
    lastUpdated: a.lastUpdated,
  }));

  const memoryTurns = input.memory.turns.slice(-6).map((turn) => ({
    role: turn.role,
    text: trimText(turn.text, 220),
  }));

  return {
    core_context: MASTER_APP_CONTEXT,
    task_context: {
      intent: input.intent,
      locale: input.locale,
      helpArticles,
    },
    data_context: input.dataContext,
    memory_context: {
      summary: trimText(input.memory.summary || "", 600),
      turns: memoryTurns,
    },
    tools: TOOL_DESCRIPTORS.filter((tool) =>
      (tool.intents as readonly string[]).includes(input.intent),
    ),
    context_budget: {
      maxPromptChars: 9000,
      memoryTurnsIncluded: memoryTurns.length,
      helpArticleCount: helpArticles.length,
      docSources: ["docs/assistant-context"],
    },
  };
}
