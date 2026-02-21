// Plan types (Starter, Growth, AI Pro)
export type PlanType = "starter" | "growth" | "ai_pro";

// Message automation types
export type MessagePurpose = "transactional" | "promotional";
export type MessageChannel = "sms" | "email";
export type MessageEventStatus = "queued" | "sent" | "failed" | "skipped";
export type DeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "rejected";
export type SmsPausedReason =
  | "none"
  | "cap_reached"
  | "billing_past_due"
  | "provider_down"
  | "manual_pause";
export type AutomationKey =
  | "appointment_confirmation"
  | "appointment_reminder_24h"
  | "appointment_reminder_72h"
  | "missed_recovery"
  | "post_visit_followup"
  | "inactivity_winback"
  | "loyalty_unlock";

// CRM mode: lite (basic) or full (advanced)
export type CrmMode = "lite" | "full";

// Workflow profile for capability templates
export type WorkflowProfile =
  | "general"
  | "service_scheduling"
  | "project_lifecycle"
  | "compliance_heavy";

// AI feature keys for quota/entitlement checks
export type AiFeatureKey =
  | "drafting"
  | "summarization"
  | "normalization"
  | "workflow_suggestions"
  | "migration_mapping"
  | "analytics_narrative";

export interface Plan {
  type: PlanType;
  name: string;
  pricePhp: number;
  aiCreditsPerMonth: number;
}

// Entity types
export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Business {
  id: string;
  organizationId: string;
  name: string;
  businessType: string;
  paymongoCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  clerkId: string;
  organizationId: string;
  role: "owner" | "staff";
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  mobile?: string;
  email?: string;
  notes?: string;
  preferences?: string;
  visitCount: number;
  lastVisitAt?: Date;
  postVisitFollowupSentAt?: Date;
  inactivityWinbackSentAt?: Date;
  loyaltyUnlockSentAt?: Date;
  smsOptedOutAt?: Date;
  allowTransactionalSms?: boolean;
  allowPromotionalSms?: boolean;
  emailOptedOutAt?: Date;
  allowTransactionalEmail?: boolean;
  allowPromotionalEmail?: boolean;
  packageTotalSessions?: number;
  packageRemainingSessions?: number;
  packageStatus?: "active" | "completed" | "none";
  packageCompletedNotifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Promo {
  id: string;
  businessId: string;
  type: "discount" | "free_addon" | "loyalty" | "reminder" | "other";
  value?: string;
  validityStart: Date;
  validityEnd: Date;
  audienceFilter?: Record<string, unknown>;
  messageContent?: string;
  status: "draft" | "sent" | "scheduled";
  createdAt: Date;
  updatedAt: Date;
}

export interface Appointment {
  id: string;
  customerId: string;
  businessId: string;
  scheduledAt: Date;
  status: "scheduled" | "completed" | "missed" | "cancelled";
  notes?: string;
  confirmationSentAt?: Date;
  reminder24hSentAt?: Date;
  reminder72hSentAt?: Date;
  missedRecoverySentAt?: Date;
  staffName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planType: PlanType;
  status: "active" | "cancelled" | "past_due" | "trialing";
  paymongoSubscriptionId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingFailureCount?: number;
  graceUntil?: Date;
  lastWebhookEventId?: string;
  planPricePhp?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiCredits {
  id: string;
  organizationId: string;
  month: string;
  allocated: number;
  used: number;
  createdAt: Date;
  updatedAt: Date;
}

// API request/response types
export interface CreateCustomerDto {
  businessId: string;
  name: string;
  mobile?: string;
  email?: string;
  notes?: string;
  preferences?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  mobile?: string;
  email?: string;
  notes?: string;
  preferences?: string;
}

export interface CreatePromoDto {
  businessId: string;
  type: Promo["type"];
  value?: string;
  validityStart: Date;
  validityEnd: Date;
  audienceFilter?: Record<string, unknown>;
}

export interface CreateAppointmentDto {
  customerId: string;
  businessId: string;
  scheduledAt: Date;
  notes?: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

// Automation types
export interface AutomationSettings {
  id: string;
  businessId: string;
  appointmentRemindersEnabled: boolean;
  appointmentReminder72hEnabled: boolean;
  missedRecoveryEnabled: boolean;
  postVisitFollowUpEnabled: boolean;
  inactivityWinbackEnabled: boolean;
  loyaltyUnlockEnabled: boolean;
  inactivityDays: number;
  autoSendChannel: MessageChannel;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageEvent {
  id: string;
  businessId: string;
  customerId: string;
  appointmentId?: string;
  automationKey: AutomationKey;
  purpose: MessagePurpose;
  channel: MessageChannel;
  content: string;
  status: MessageEventStatus;
  deliveryStatus?: DeliveryStatus;
  retryCount?: number;
  provider?: string;
  providerMetadata?: Record<string, unknown>;
  costMicros?: number;
  providerMessageId?: string;
  failureReason?: string;
  sentBy: string;
  sentAt?: Date;
  createdAt: Date;
}

export interface SmsCredits {
  id: string;
  organizationId: string;
  month: string;
  included: number;
  addon: number;
  used: number;
  pausedReason: SmsPausedReason;
  createdAt: Date;
  updatedAt: Date;
}

export interface SmsUsageEvent {
  id: string;
  messageEventId: string;
  organizationId: string;
  businessId: string;
  units: number;
  status: string;
  costMicros?: number;
  createdAt: Date;
}

export interface SmsAddon {
  id: string;
  organizationId: string;
  packSize: number;
  packPricePhp: number;
  purchasedByUserId?: string;
  purchasedAt: Date;
  consumedUnits: number;
  createdAt: Date;
}

export interface ConsentAuditLog {
  id: string;
  customerId: string;
  channel: string;
  purpose: string;
  before: string;
  after: string;
  source: string;
  actorUserId?: string;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  actorUserId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

export interface PrivacyRequest {
  id: string;
  organizationId: string;
  type: string;
  status: string;
  requestedBy?: string;
  processedAt?: Date;
  createdAt: Date;
}
