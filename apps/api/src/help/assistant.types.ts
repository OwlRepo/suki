export type AssistantActionChip = {
  label: string;
  href: string;
  kind: "primary" | "secondary";
};

export type AssistantFallback = {
  reason: "low_confidence" | "no_source" | "out_of_scope" | "capped";
};

export type AssistantNotice = {
  kind: "draft_only";
  text: "Draft only. Nothing was saved or sent.";
};

export type AssistantChatResponse = {
  threadId?: string;
  plainAnswer: string;
  nextStep: string;
  details?: string;
  actionChips: AssistantActionChip[];
  confidence: number;
  fallback?: AssistantFallback;
  notices?: AssistantNotice[];
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
        aiEnabled?: boolean;
      };
    }
  | {
      type: "confirmation";
      confirmation: {
        token: string;
        action: "update_customer" | "reschedule_appointment";
        summary: string;
        expiresAt: string;
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
        aiEnabled?: boolean;
      };
    };
