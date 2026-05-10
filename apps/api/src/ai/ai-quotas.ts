import type { PlanType } from "@suki/types";

export interface AiQuotaConfig {
  monthlyTokenLimit: number;
  monthlyRequestLimit: number;
  perUserRpm: number;
  perOrgRpm: number;
  maxConcurrentJobs: number;
  allowedFeatures: string[];
  maxInputPromptTokens: number;
  maxContextRecords: number;
  idempotencyWindowSec: number;
  dailyCapPct: number;
  perFeatureMaxOutputTokens: Record<string, number>;
}

export const AI_QUOTAS: Record<PlanType, AiQuotaConfig> = {
  starter: {
    monthlyTokenLimit: 100_000,
    monthlyRequestLimit: 100,
    perUserRpm: 10,
    perOrgRpm: 40,
    maxConcurrentJobs: 5,
    allowedFeatures: [
      "drafting",
      "summarization",
      "normalization",
      "workflow_suggestions",
      "migration_mapping",
      "analytics_narrative",
    ],
    maxInputPromptTokens: 2_000,
    maxContextRecords: 50,
    idempotencyWindowSec: 60,
    dailyCapPct: 0.2,
    perFeatureMaxOutputTokens: {
      drafting: 600,
      summarization: 400,
      normalization: 300,
      workflow_suggestions: 600,
      migration_mapping: 300,
      analytics_narrative: 600,
    },
  },
  growth: {
    monthlyTokenLimit: 100_000,
    monthlyRequestLimit: 100,
    perUserRpm: 10,
    perOrgRpm: 40,
    maxConcurrentJobs: 5,
    allowedFeatures: ["drafting", "summarization", "normalization"],
    maxInputPromptTokens: 2_000,
    maxContextRecords: 50,
    idempotencyWindowSec: 60,
    dailyCapPct: 0.2,
    perFeatureMaxOutputTokens: {
      drafting: 600,
      summarization: 400,
      normalization: 300,
    },
  },
  pro: {
    monthlyTokenLimit: 100_000,
    monthlyRequestLimit: 100,
    perUserRpm: 30,
    perOrgRpm: 120,
    maxConcurrentJobs: 20,
    allowedFeatures: [
      "drafting",
      "summarization",
      "normalization",
      "workflow_suggestions",
      "migration_mapping",
      "analytics_narrative",
    ],
    maxInputPromptTokens: 2_000,
    maxContextRecords: 50,
    idempotencyWindowSec: 60,
    dailyCapPct: 0.2,
    perFeatureMaxOutputTokens: {
      drafting: 1_200,
      summarization: 800,
      normalization: 600,
      workflow_suggestions: 1_000,
      migration_mapping: 600,
      analytics_narrative: 1_000,
    },
  },
};

export const AI_SHARED_SAFEGUARDS = {
  maxInputPromptTokens: 2_000,
  maxContextRecords: 50,
  idempotencyWindowSec: 60,
} as const;
