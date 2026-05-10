export type AssistantActionChip = {
  label: string;
  href: string;
  kind: "primary" | "secondary";
};

export type AssistantFallback = {
  reason: "low_confidence" | "no_source" | "out_of_scope" | "capped";
};

export type AssistantChatResponse = {
  threadId?: string;
  plainAnswer: string;
  nextStep: string;
  details?: string;
  actionChips: AssistantActionChip[];
  confidence: number;
  fallback?: AssistantFallback;
};

export type AssistantChatStreamEvent =
  | { type: "meta"; threadId: string; intent: string }
  | { type: "state"; state: "sending" | "streaming" | "sent" | "read" | "error" }
  | {
      type: "stage";
      stage: "normalize" | "intent" | "context" | "tools" | "openai" | "validate" | "finalize";
    }
  | { type: "delta"; chunk: string }
  | { type: "actions"; actionChips: AssistantActionChip[] }
  | {
      type: "usage";
      usage: {
        tokensUsed: number;
        tokensLimit: number;
        requestsUsed: number;
        requestsLimit: number;
        dailyTokensUsed?: number;
        dailyTokensLimit?: number;
        dailyRequestsUsed?: number;
        dailyRequestsLimit?: number;
        dailyResetDateTime?: string;
        resetDate?: string;
      };
    }
  | { type: "done"; response: AssistantChatResponse }
  | {
      type: "error";
      message: string;
      code?: string;
      actionChips?: AssistantActionChip[];
      meta?: {
        dailyTokensRemaining?: number;
        dailyRequestsRemaining?: number;
        dailyResetDateTime?: string;
      };
    };
