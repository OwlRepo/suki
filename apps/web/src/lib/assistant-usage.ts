export type AiUsageSummary = {
  tokensUsed: number;
  tokensLimit: number;
  requestsUsed: number;
  requestsLimit: number;
  resetDate?: string;
  dailyTokensUsed?: number;
  dailyTokensLimit?: number;
  dailyTokensRemaining?: number;
  dailyRequestsUsed?: number;
  dailyRequestsLimit?: number;
  dailyRequestsRemaining?: number;
  dailyResetDateTime?: string;
  aiEnabled?: boolean;
};

export type UsageState = "normal" | "warning" | "capped";

export type UsageModel = {
  tokens: { used: number; limit: number; remaining: number; pct: number; state: UsageState };
  messages: { used: number; limit: number; remaining: number; pct: number; state: UsageState };
  daily: {
    tokens: { used: number; limit: number; remaining: number; pct: number; state: UsageState };
    messages: { used: number; limit: number; remaining: number; pct: number; state: UsageState };
  };
  resetLabel: string;
  dailyResetLabel: string;
  capped: boolean;
  dailyCapped: boolean;
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
  const dailyTokensLimit = Math.max(0, summary.dailyTokensLimit ?? 0);
  const dailyTokensUsed = Math.max(0, summary.dailyTokensUsed ?? 0);
  const dailyMessageLimit = Math.max(0, summary.dailyRequestsLimit ?? 0);
  const dailyMessageUsed = Math.max(0, summary.dailyRequestsUsed ?? 0);
  const dailyTokenPct = dailyTokensLimit > 0 ? dailyTokensUsed / dailyTokensLimit : 0;
  const dailyMessagePct = dailyMessageLimit > 0 ? dailyMessageUsed / dailyMessageLimit : 0;
  const dailyTokensRemaining = Math.max(
    0,
    summary.dailyTokensRemaining ?? dailyTokensLimit - dailyTokensUsed,
  );
  const dailyMessagesRemaining = Math.max(
    0,
    summary.dailyRequestsRemaining ?? dailyMessageLimit - dailyMessageUsed,
  );
  const dailyCapped =
    (dailyTokensLimit > 0 && dailyTokensRemaining <= 0) ||
    (dailyMessageLimit > 0 && dailyMessagesRemaining <= 0);

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
    daily: {
      tokens: {
        used: dailyTokensUsed,
        limit: dailyTokensLimit,
        remaining: dailyTokensRemaining,
        pct: dailyTokenPct,
        state: stateFromPct(dailyTokenPct),
      },
      messages: {
        used: dailyMessageUsed,
        limit: dailyMessageLimit,
        remaining: dailyMessagesRemaining,
        pct: dailyMessagePct,
        state: stateFromPct(dailyMessagePct),
      },
    },
    resetLabel: formatResetLabel(summary.resetDate),
    dailyResetLabel: formatResetLabel(summary.dailyResetDateTime),
    capped: tokensRemaining <= 0 || messagesRemaining <= 0 || dailyCapped,
    dailyCapped,
    aiEnabled: summary.aiEnabled !== false,
  };
}
