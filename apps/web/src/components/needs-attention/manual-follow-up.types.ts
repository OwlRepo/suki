export interface ManualFollowUpTask {
  id: string;
  businessId: string;
  originalMessageEventId: string;
  retryMessageEventId: string | null;
  customerId: string;
  appointmentId: string | null;
  status: "open" | "contacted" | "dismissed";
  recipientMobile: string;
  messageBody: string;
  failureReason: string;
  createdAt: string;
  customerName: string;
  businessName: string;
  appointmentScheduledAt: string | null;
  duplicateRisk: boolean;
}
