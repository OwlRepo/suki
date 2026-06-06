// Billing and plan types
export type PlanType = "free" | "starter" | "growth" | "pro";
export type BillingInterval = "monthly" | "annual";
export type BillingProvider = "lemonsqueezy";
export type BillingPurchaseKind =
  | "subscription"
  | "online_booking_topup"
  | "sms_segment_topup";
export type BillingAddonSku =
  | "online-booking-topup-10"
  | "online-booking-topup-25"
  | "online-booking-topup-50"
  | "online-booking-topup-100"
  | "online-booking-topup-250"
  | "sms-segment-topup-25"
  | "sms-segment-topup-50"
  | "sms-segment-topup-100"
  | "sms-segment-topup-250";
export type PlatformAdminRoleCode =
  | "FOUNDER"
  | "OPERATIONS"
  | "FINANCE"
  | "SUPPORT";
export type PlatformAdminPermission =
  | "PLATFORM_ADMIN_ACCESS"
  | "OVERVIEW_VIEW"
  | "BUSINESS_VIEW"
  | "BUSINESS_UPDATE"
  | "BUSINESS_SUSPEND"
  | "BILLING_REQUEST_VIEW"
  | "BILLING_REQUEST_CREATE"
  | "BILLING_REQUEST_VOID"
  | "PAYMENT_VIEW"
  | "PAYMENT_RECORD"
  | "PAYMENT_VERIFY"
  | "PAYMENT_REJECT"
  | "SMS_CREDIT_VIEW"
  | "SMS_CREDIT_GRANT_PROMOTIONAL"
  | "SMS_CREDIT_APPLY_CORRECTION"
  | "COMMUNICATION_VIEW"
  | "AUTOMATION_RUN_VIEW"
  | "ALERT_VIEW"
  | "ALERT_ACKNOWLEDGE"
  | "AUDIT_LOG_VIEW";

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
export type OrgBillingStatus =
  | "trial_active"
  | "trial_expired"
  | "active_manual"
  | "past_due_manual"
  | "cancelled_manual"
  | "suspended"
  | "free_active"
  | "subscription_active"
  | "subscription_past_due"
  | "subscription_cancelled"
  | "subscription_expired"
  | "subscription_paused";
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

export const PH_MOBILE_E164_PLACEHOLDER = "+639171234567";
export const PH_MOBILE_E164_ERROR = "Use +63 format, for example +639171234567.";

export function isValidPhilippineMobileE164(value: string | null | undefined): boolean {
  return /^\+639\d{9}$/.test(value?.trim() ?? "");
}

export function normalizePhilippineMobileE164(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return isValidPhilippineMobileE164(trimmed) ? trimmed : null;
}

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
  trialStartsAt?: Date | null;
  trialEndsAt?: Date | null;
  billingStatus?: OrgBillingStatus | null;
  currentPlan?: PlanType | null;
  manualBillingNotes?: string | null;
  lastBillingAt?: Date | null;
  nextBillingDueAt?: Date | null;
  billingPausedAt?: Date | null;
  accessEndsAt?: Date | null;
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
  status:
    | "active"
    | "cancelled"
    | "past_due"
    | "trialing"
    | "paused"
    | "expired"
    | "unpaid";
  provider?: BillingProvider | null;
  billingInterval?: BillingInterval | null;
  paymongoSubscriptionId?: string | null;
  providerSubscriptionId?: string | null;
  providerCustomerId?: string | null;
  providerOrderId?: string | null;
  providerProductId?: string | null;
  providerVariantId?: string | null;
  providerSubscriptionItemId?: string | null;
  cancelled?: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  renewsAt?: Date | null;
  endsAt?: Date | null;
  trialEndsAt?: Date | null;
  cardBrand?: string | null;
  cardLastFour?: string | null;
  updatePaymentMethodUrl?: string | null;
  customerPortalUrl?: string | null;
  scheduledPlanType?: PlanType | null;
  scheduledBillingInterval?: BillingInterval | null;
  scheduledChangeEffectiveAt?: Date | null;
  billingFailureCount?: number;
  graceUntil?: Date | null;
  lastWebhookEventId?: string | null;
  lastProviderEventId?: string | null;
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
