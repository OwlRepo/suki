export type AiUsageSummary = {
  tokensUsed: number;
  tokensLimit: number;
  requestsUsed: number;
  requestsLimit: number;
  resetDate?: string;
  aiEnabled?: boolean;
};

export type UsageState = "normal" | "warning" | "capped";

export type UsageModel = {
  tokens: { used: number; limit: number; remaining: number; pct: number; state: UsageState };
  messages: { used: number; limit: number; remaining: number; pct: number; state: UsageState };
  resetLabel: string;
  capped: boolean;
  aiEnabled: boolean;
};

function stateFromPct(pct: number): UsageState {
  if (pct >= 1) return "capped";
  if (pct >= 0.8) return "warning";
  return "normal";
}

function formatResetLabel(resetDate?: string): string {
  if (!resetDate) return "Reset date not available";
  const parsed = new Date(resetDate);
  if (Number.isNaN(parsed.getTime())) return "Reset date not available";
  return `Resets on ${parsed.toLocaleDateString()}`;
}

export function buildUsageModel(summary: AiUsageSummary): UsageModel {
  const tokensLimit = Math.max(0, summary.tokensLimit ?? 0);
  const tokensUsed = Math.max(0, summary.tokensUsed ?? 0);
  const messageLimit = Math.max(0, summary.requestsLimit ?? 0);
  const messageUsed = Math.max(0, summary.requestsUsed ?? 0);
  const tokenPct = tokensLimit > 0 ? tokensUsed / tokensLimit : 0;
  const messagePct = messageLimit > 0 ? messageUsed / messageLimit : 0;

  const tokensRemaining = Math.max(0, tokensLimit - tokensUsed);
  const messagesRemaining = Math.max(0, messageLimit - messageUsed);

  return {
    tokens: {
      used: tokensUsed,
      limit: tokensLimit,
      remaining: tokensRemaining,
      pct: tokenPct,
      state: stateFromPct(tokenPct),
    },
    messages: {
      used: messageUsed,
      limit: messageLimit,
      remaining: messagesRemaining,
      pct: messagePct,
      state: stateFromPct(messagePct),
    },
    resetLabel: formatResetLabel(summary.resetDate),
    capped: tokensRemaining <= 0 || messagesRemaining <= 0,
    aiEnabled: summary.aiEnabled !== false,
  };
}

