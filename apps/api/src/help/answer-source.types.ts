export type AnswerSourceDomain =
  | "business_summary"
  | "sms_usage"
  | "billing_status"
  | "ai_usage";

export type AnswerSourceResponse<T> = {
  domain: AnswerSourceDomain;
  available: boolean;
  canonical: T | null;
  humanReadable: string;
  asOf: string;
  businessScope: string | null;
};
