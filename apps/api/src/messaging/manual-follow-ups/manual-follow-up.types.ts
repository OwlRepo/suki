import type { AutomationKey, MessagePurpose } from "@tyvera/types";

export type ManualFollowUpStatus = "open" | "contacted" | "dismissed";

export interface CreateManualFollowUpFromEventInput {
  organizationId: string;
  businessId: string;
  originalMessageEventId: string;
  manualRetryRawMessage: string;
  fallbackFailureReason?: string;
}

export interface ResolveManualFollowUpInput {
  organizationId: string;
  userId: string;
  taskId: string;
  status: Extract<ManualFollowUpStatus, "contacted" | "dismissed">;
}

export interface AttachRetryMessageEventInput {
  organizationId: string;
  userId: string;
  taskId: string;
  retryMessageEventId: string;
}

export interface ManualFollowUpTaskView {
  id: string;
  organizationId: string;
  businessId: string;
  originalMessageEventId: string;
  retryMessageEventId: string | null;
  customerId: string;
  appointmentId: string | null;
  automationKey: AutomationKey;
  purpose: MessagePurpose;
  status: ManualFollowUpStatus;
  recipientMobile: string;
  messageBody: string;
  manualRetryRawMessage: string;
  failureReason: string;
  notifiedAt: Date | null;
  createdAt: Date;
  customerName: string;
  businessName: string;
  appointmentScheduledAt: Date | null;
  duplicateRisk: boolean;
}
