export type CommunicationChannel = "sms" | "email";
export type DeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "rejected";
export type CommunicationsRange = "24h" | "7d" | "30d";

export type PlatformAdminCommunicationListItem = {
  id: string;
  organizationId: string;
  organizationName: string;
  businessId: string;
  businessName: string;
  appointmentId: string | null;
  customerId: string;
  customerName: string;
  recipientMasked: string | null;
  channel: CommunicationChannel;
  automationKey: string;
  purpose: "transactional" | "promotional";
  status: "queued" | "sent" | "failed" | "skipped";
  deliveryStatus: DeliveryStatus | null;
  provider: string | null;
  retryCount: number;
  unitsConsumed: number;
  failureReason: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type PlatformAdminCommunicationListResponse = {
  items: PlatformAdminCommunicationListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PlatformAdminCommunicationsSummary = {
  range: CommunicationsRange;
  totals: {
    smsQueued: number;
    smsSent: number;
    smsFailed: number;
    smsDelivered: number;
    emailSent: number;
    emailDelivered: number;
    emailFailed: number;
    emailBounced: number;
    emailRejected: number;
    openManualFollowUps: number;
    otpSendFailures: number;
  };
  failureRates: {
    smsFailureRatePct: number;
    emailFailureRatePct: number;
    otpFailureRatePct: number;
  };
  series: Array<{
    bucket: string;
    smsSent: number;
    smsFailed: number;
    emailDelivered: number;
    emailFailed: number;
    otpFailures: number;
  }>;
};

export type PlatformAdminCommunicationDetail = {
  id: string;
  organization: {
    id: string;
    name: string;
  };
  business: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    name: string;
    recipientMasked: string | null;
  };
  appointmentId: string | null;
  automationKey: string;
  purpose: "transactional" | "promotional";
  channel: CommunicationChannel;
  status: "queued" | "sent" | "failed" | "skipped";
  deliveryStatus: DeliveryStatus | null;
  provider: string | null;
  providerMessageId: string | null;
  retryCount: number;
  unitsConsumed: number;
  failureReason: string | null;
  sentAt: string | null;
  createdAt: string;
  manualFollowUpTask: {
    id: string;
    status: "open" | "contacted" | "dismissed";
    failureReason: string;
    createdAt: string;
    resolvedAt: string | null;
  } | null;
};

export type PlatformAdminCommunicationFilters = {
  range?: CommunicationsRange;
  channel?: CommunicationChannel;
  provider?: string;
  deliveryStatus?: DeliveryStatus;
  automationKey?: string;
  organizationId?: string;
  businessId?: string;
  page?: number;
  limit?: number;
};
