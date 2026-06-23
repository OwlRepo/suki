import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  unique,
  index,
} from "drizzle-orm/pg-core";

// Enums
export const planTypeEnum = pgEnum("plan_type", ["free", "starter", "growth", "pro"]);
export const userRoleEnum = pgEnum("user_role", ["owner", "staff"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "cancelled",
  "past_due",
  "trialing",
  "paused",
  "expired",
  "unpaid",
]);
export const promoTypeEnum = pgEnum("promo_type", [
  "discount",
  "free_addon",
  "loyalty",
  "reminder",
  "other",
]);
export const promoStatusEnum = pgEnum("promo_status", ["draft", "sent", "scheduled"]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "checked_in",
  "needs_review",
  "completed",
  "missed",
  "cancelled",
]);
export const appointmentVerificationModeEnum = pgEnum("appointment_verification_mode", [
  "otp_verified",
  "pin_override",
]);
export const messagePurposeEnum = pgEnum("message_purpose", [
  "transactional",
  "promotional",
]);
export const messageChannelEnum = pgEnum("message_channel", ["sms", "email"]);
export const messageEventStatusEnum = pgEnum("message_event_status", [
  "queued",
  "sent",
  "failed",
  "skipped",
]);
export const manualFollowUpStatusEnum = pgEnum("manual_follow_up_status", [
  "open",
  "contacted",
  "dismissed",
]);
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
  "bounced",
  "rejected",
]);
export const smsPausedReasonEnum = pgEnum("sms_paused_reason", [
  "none",
  "cap_reached",
  "billing_past_due",
  "provider_down",
  "manual_pause",
]);
export const orgBillingStatusEnum = pgEnum("org_billing_status", [
  "trial_active",
  "trial_expired",
  "active_manual",
  "past_due_manual",
  "cancelled_manual",
  "suspended",
  "free_active",
  "subscription_active",
  "subscription_past_due",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_paused",
]);
export const platformAdminStatusEnum = pgEnum("platform_admin_status", [
  "active",
  "disabled",
]);
export const manualBillingRequestStatusEnum = pgEnum(
  "manual_billing_request_status",
  [
    "draft",
    "awaiting_payment",
    "payment_reported",
    "paid_and_fulfilled",
    "rejected",
    "void",
  ],
);
export const clientBillingRequestKindEnum = pgEnum(
  "client_billing_request_kind",
  ["plan_change", "sms_topup", "cancellation"],
);
export const clientBillingRequestStatusEnum = pgEnum(
  "client_billing_request_status",
  ["submitted", "under_review", "approved", "declined", "cancelled"],
);
export const manualPaymentStatusEnum = pgEnum("manual_payment_status", [
  "pending",
  "verified",
  "rejected",
]);
export const manualPaymentMethodEnum = pgEnum("manual_payment_method", [
  "gcash",
  "bank_transfer",
  "other",
]);
export const automationJobRunStatusEnum = pgEnum("automation_job_run_status", [
  "running",
  "completed",
  "failed",
]);
export const operationsAlertSeverityEnum = pgEnum(
  "operations_alert_severity",
  ["info", "warning", "critical"],
);
export const operationsAlertStatusEnum = pgEnum("operations_alert_status", [
  "open",
  "acknowledged",
  "resolved",
]);

// Organizations — tenant for multi-business (future)
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  trialStartsAt: timestamp("trial_starts_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  billingStatus: orgBillingStatusEnum("billing_status").default("trial_active"),
  currentPlan: planTypeEnum("current_plan").default("free"),
  manualBillingNotes: text("manual_billing_notes"),
  lastBillingAt: timestamp("last_billing_at"),
  nextBillingDueAt: timestamp("next_billing_due_at"),
  billingPausedAt: timestamp("billing_paused_at"),
  accessEndsAt: timestamp("access_ends_at"),
  billingContactName: text("billing_contact_name"),
  billingContactMobile: text("billing_contact_mobile"),
  billingContactEmail: text("billing_contact_email"),
  preferredPaymentMethod: manualPaymentMethodEnum("preferred_payment_method"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Businesses — business profile and CRM/payment linkage fields (defined before customerDescriptionTemplates to avoid circular ref)
export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  businessType: text("business_type").notNull(),
  paymongoCustomerId: text("paymongo_customer_id"),
  crmMode: text("crm_mode").notNull().default("lite"),
  workflowProfile: text("workflow_profile").notNull().default("general"),
  brandColor: text("brand_color"),
  logoUrl: text("logo_url"),
  tagline: text("tagline"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Customer description templates — guided fields for composing customer notes (dynamic by business type)
export const customerDescriptionTemplates = pgTable(
  "customer_description_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    businessType: text("business_type"), // When set, template only applies to businesses of this type
    name: text("name").notNull(),
    fieldsConfig: jsonb("fields_config")
      .$type<Array<{ key: string; label: string; placeholder?: string }>>()
      .notNull()
      .default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

// Business default template — separate table to avoid circular FK (businesses <-> customerDescriptionTemplates)
export const businessDefaultDescriptionTemplates = pgTable(
  "business_default_description_templates",
  {
    businessId: uuid("business_id")
      .primaryKey()
      .references(() => businesses.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => customerDescriptionTemplates.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

// Users — Clerk user id, role, org link
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  role: userRoleEnum("role").notNull(),
  email: text("email"),
  activeBusinessId: uuid("active_business_id").references(() => businesses.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const platformAdmins = pgTable(
  "platform_admins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: platformAdminStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("platform_admins_user_id_unique").on(t.userId)],
);

export const adminRoles = pgTable(
  "admin_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isSystemRole: text("is_system_role").notNull().default("true"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("admin_roles_code_unique").on(t.code)],
);

export const adminPermissions = pgTable(
  "admin_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("admin_permissions_code_unique").on(t.code)],
);

export const platformAdminRoles = pgTable(
  "platform_admin_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platformAdminId: uuid("platform_admin_id")
      .notNull()
      .references(() => platformAdmins.id, { onDelete: "cascade" }),
    adminRoleId: uuid("admin_role_id")
      .notNull()
      .references(() => adminRoles.id, { onDelete: "cascade" }),
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (t) => [
    unique("platform_admin_roles_admin_role_unique").on(
      t.platformAdminId,
      t.adminRoleId,
    ),
  ],
);

export const adminRolePermissions = pgTable(
  "admin_role_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminRoleId: uuid("admin_role_id")
      .notNull()
      .references(() => adminRoles.id, { onDelete: "cascade" }),
    adminPermissionId: uuid("admin_permission_id")
      .notNull()
      .references(() => adminPermissions.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique("admin_role_permissions_role_permission_unique").on(
      t.adminRoleId,
      t.adminPermissionId,
    ),
  ],
);

export const platformAdminAuditLogs = pgTable(
  "platform_admin_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorPlatformAdminId: uuid("actor_platform_admin_id").references(
      () => platformAdmins.id,
      { onDelete: "set null" },
    ),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("platform_admin_audit_logs_actor_idx").on(t.actorPlatformAdminId),
    index("platform_admin_audit_logs_organization_idx").on(t.organizationId),
    index("platform_admin_audit_logs_action_idx").on(t.action),
    index("platform_admin_audit_logs_created_at_idx").on(t.createdAt),
  ],
);

export const authIdentities = pgTable("auth_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const authOtpChallenges = pgTable(
  "auth_otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    purpose: text("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("auth_otp_challenges_email_purpose_idx").on(t.email, t.purpose, t.createdAt)],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("auth_sessions_user_id_idx").on(t.userId)],
);

// Customers — name, mobile, notes, visit_count, last_visit, business_id
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mobile: text("mobile"),
    notes: text("notes"),
    preferences: text("preferences"),
    tags: text("tags"), // Comma-separated retention tags, e.g. "vip,frequent"
    visitCount: integer("visit_count").notNull().default(0),
    lastVisitAt: timestamp("last_visit_at"),
    postVisitFollowupSentAt: timestamp("post_visit_followup_sent_at"),
    inactivityWinbackSentAt: timestamp("inactivity_winback_sent_at"),
    loyaltyUnlockSentAt: timestamp("loyalty_unlock_sent_at"),
    smsOptedOutAt: timestamp("sms_opted_out_at"),
    allowTransactionalSms: text("allow_transactional_sms").notNull().default("true"),
    allowPromotionalSms: text("allow_promotional_sms").notNull().default("false"),
    email: text("email"),
    emailOptedOutAt: timestamp("email_opted_out_at"),
    allowTransactionalEmail: text("allow_transactional_email").notNull().default("true"),
    allowPromotionalEmail: text("allow_promotional_email").notNull().default("false"),
    packageTotalSessions: integer("package_total_sessions"),
    packageRemainingSessions: integer("package_remaining_sessions"),
    packageStatus: text("package_status").notNull().default("none"),
    packageCompletedNotifiedAt: timestamp("package_completed_notified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("customers_last_visit_at_idx").on(t.lastVisitAt),
    index("customers_inactivity_winback_sent_at_idx").on(t.inactivityWinbackSentAt),
    index("customers_business_mobile_idx").on(t.businessId, t.mobile),
  ],
);

// Visit adjustment history — audit trail for visit count corrections
export const visitAdjustmentHistory = pgTable(
  "visit_adjustment_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    beforeCount: integer("before_count").notNull(),
    afterCount: integer("after_count").notNull(),
    reason: text("reason").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorClerkId: text("actor_clerk_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("visit_adjustment_history_customer_id_idx").on(t.customerId)],
);

// Promos — structured promo data, status
export const promos = pgTable("promos", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  type: promoTypeEnum("type").notNull(),
  value: text("value"),
  validityStart: timestamp("validity_start").notNull(),
  validityEnd: timestamp("validity_end").notNull(),
  audienceFilter: jsonb("audience_filter"),
  messageContent: text("message_content"),
  status: promoStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Deals — Full CRM pipeline (Full mode only)
export const deals = pgTable("deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  stage: text("stage").notNull(),
  amount: integer("amount"),
  ownerUserId: uuid("owner_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Deal stages — configurable pipeline stages per business (Full mode)
export const dealStages = pgTable(
  "deal_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("deal_stages_business_id_name_unique").on(t.businessId, t.name)],
);

// Activities — CRM interactions: calls, meetings, emails, notes (Full mode)
export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
  type: text("type").notNull(), // call, meeting, email, note
  subject: text("subject"),
  notes: text("notes"),
  createdByUserId: uuid("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Custom fields — extensible metadata per business (Full mode)
export const customFields = pgTable("custom_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // customer, deal, etc.
  fieldName: text("field_name").notNull(),
  fieldType: text("field_type").notNull().default("text"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tasks — Full CRM (Full mode only)
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  assigneeUserId: uuid("assignee_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Appointments — customer_id, date, time, status
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    checkedInAt: timestamp("checked_in_at"),
    needsReviewAt: timestamp("needs_review_at"),
    completedAt: timestamp("completed_at"),
    visitRecordedAt: timestamp("visit_recorded_at"),
    status: appointmentStatusEnum("status").notNull().default("scheduled"),
    notes: text("notes"),
    confirmationSentAt: timestamp("confirmation_sent_at"),
    reminder24hSentAt: timestamp("reminder_24h_sent_at"),
    reminder72hSentAt: timestamp("reminder_72h_sent_at"),
    missedRecoverySentAt: timestamp("missed_recovery_sent_at"),
    staffName: text("staff_name"),
    verificationMode: appointmentVerificationModeEnum("verification_mode").notNull().default("otp_verified"),
    otpSkipReason: text("otp_skip_reason"),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("appointments_scheduled_at_idx").on(t.scheduledAt),
    index("appointments_status_scheduled_at_idx").on(t.status, t.scheduledAt),
    index("appointments_visit_recorded_at_idx").on(t.visitRecordedAt),
    index("appointments_reminder_24h_sent_at_idx").on(t.reminder24hSentAt),
    index("appointments_reminder_72h_sent_at_idx").on(t.reminder72hSentAt),
  ],
);

export const bookingSecuritySettings = pgTable("booking_security_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  otpSkipPinHash: text("otp_skip_pin_hash").notNull(),
  otpSkipPinSetByUserId: uuid("otp_skip_pin_set_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  otpSkipPinSetAt: timestamp("otp_skip_pin_set_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bookingPinAttemptLogs = pgTable(
  "booking_pin_attempt_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    success: text("success").notNull().default("false"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("booking_pin_attempt_logs_business_user_created_idx").on(
      t.businessId,
      t.actorUserId,
      t.createdAt,
    ),
  ],
);

export const appointmentShareTemplates = pgTable(
  "appointment_share_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slots: jsonb("slots").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("appointment_share_templates_business_name_unique").on(t.businessId, t.name)],
);

// Booking holds — temporary slot reservation pending OTP verification
export const bookingHolds = pgTable(
  "booking_holds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    mobile: text("mobile").notNull(),
    scheduledAt: timestamp("scheduled_at").notNull(),
    status: text("status").notNull().default("held"), // held | confirmed | expired | released
    otpSid: text("otp_sid"),
    otpProvider: text("otp_provider"),
    otpCodeHash: text("otp_code_hash"),
    otpCodeExpiresAt: timestamp("otp_code_expires_at"),
    otpProviderMessageId: text("otp_provider_message_id"),
    otpAttempts: integer("otp_attempts").notNull().default(0),
    otpSentCount: integer("otp_sent_count").notNull().default(0),
    otpLastSentAt: timestamp("otp_last_sent_at"),
    otpCooldownEndsAt: timestamp("otp_cooldown_ends_at"),
    otpSendWindowKey: text("otp_send_window_key"),
    expiresAt: timestamp("expires_at").notNull(),
    confirmedAt: timestamp("confirmed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("booking_holds_business_scheduled_idx").on(t.businessId, t.scheduledAt),
    index("booking_holds_expires_at_idx").on(t.expiresAt),
    index("booking_holds_status_idx").on(t.status),
    index("booking_holds_otp_provider_idx").on(t.otpProvider),
  ],
);

export const otpProviderSettings = pgTable(
  "otp_provider_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("twilio"),
    switchedAt: timestamp("switched_at"),
    switchReason: text("switch_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    unique("otp_provider_settings_organization_unique").on(t.organizationId),
    index("otp_provider_settings_org_idx").on(t.organizationId),
  ],
);

// Subscriptions — plan, status, and provider-neutral subscription identifiers
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  planType: planTypeEnum("plan_type").notNull(),
  status: subscriptionStatusEnum("status").notNull(),
  paymongoSubscriptionId: text("paymongo_subscription_id"),
  provider: text("provider"),
  providerSubscriptionId: text("provider_subscription_id"),
  providerCustomerId: text("provider_customer_id"),
  providerOrderId: text("provider_order_id"),
  providerProductId: text("provider_product_id"),
  providerVariantId: text("provider_variant_id"),
  providerSubscriptionItemId: text("provider_subscription_item_id"),
  billingInterval: text("billing_interval"),
  cancelled: text("cancelled").notNull().default("false"),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  renewsAt: timestamp("renews_at"),
  endsAt: timestamp("ends_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  cardBrand: text("card_brand"),
  cardLastFour: text("card_last_four"),
  updatePaymentMethodUrl: text("update_payment_method_url"),
  customerPortalUrl: text("customer_portal_url"),
  scheduledPlanType: planTypeEnum("scheduled_plan_type"),
  scheduledBillingInterval: text("scheduled_billing_interval"),
  scheduledChangeEffectiveAt: timestamp("scheduled_change_effective_at"),
  pendingSyncAction: text("pending_sync_action"),
  pendingSyncStartedAt: timestamp("pending_sync_started_at"),
  pendingSyncTargetPlanType: planTypeEnum("pending_sync_target_plan_type"),
  pendingSyncTargetBillingInterval: text("pending_sync_target_billing_interval"),
  billingFailureCount: integer("billing_failure_count").notNull().default(0),
  graceUntil: timestamp("grace_until"),
  lastWebhookEventId: text("last_webhook_event_id"),
  lastProviderEventId: text("last_provider_event_id"),
  planPricePhp: integer("plan_price_php").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI credits — per org/business, monthly allocation, used count
export const aiCredits = pgTable("ai_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // YYYY-MM format
  allocated: integer("allocated").notNull().default(0),
  used: integer("used").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI usage events — per-request token/cost tracking
export const aiUsageEvents = pgTable("ai_usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id"),
  businessId: uuid("business_id"),
  feature: text("feature").notNull(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCostMicros: integer("estimated_cost_micros").default(0),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI budgets — org-level monthly limits and policies
export const aiBudgets = pgTable("ai_budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // YYYY-MM format
  tokenLimit: integer("token_limit").notNull(),
  requestLimit: integer("request_limit").notNull(),
  softCapPct: integer("soft_cap_pct").default(90),
  aiEnabled: text("ai_enabled").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// License challenges — offline/air-gapped activation challenge-response
export const licenseChallenges = pgTable("license_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  challenge: text("challenge").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// License activations — on-prem activation records and anti-sharing
export const licenseActivations = pgTable("license_activations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  machineFingerprint: text("machine_fingerprint"),
  licensePayload: text("license_payload"),
  activatedAt: timestamp("activated_at").defaultNow().notNull(),
  lastAttestationAt: timestamp("last_attestation_at"),
  status: text("status").notNull().default("active"),
});

// Import batches — for rollback and reconciliation
export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  source: text("source").notNull().default("csv"),
  entityType: text("entity_type").notNull().default("contacts"),
  customerIds: jsonb("customer_ids").$type<string[]>().default([]),
  status: text("status").notNull().default("completed"),
  importedCount: integer("imported_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  errorDetails: jsonb("error_details").$type<Array<{ rowIndex: number; message: string }>>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Onboarding progress — per-org/user setup state
export const onboardingProgress = pgTable("onboarding_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id"),
  currentStep: integer("current_step").notNull().default(0),
  completedSteps: jsonb("completed_steps").$type<string[]>().default([]),
  timeToFirstValueAt: timestamp("time_to_first_value_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Assistant thread memory — per-org/user/thread rolling summary + recent turns
export const assistantThreadMemories = pgTable(
  "assistant_thread_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    threadId: text("thread_id").notNull(),
    summary: text("summary").notNull().default(""),
    lastTurns: jsonb("last_turns")
      .$type<Array<{ role: "user" | "assistant"; text: string }>>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("assistant_thread_memories_unique").on(t.organizationId, t.userId, t.threadId)],
);

// Automation settings — per-business toggle and channel config
export const automationSettings = pgTable(
  "automation_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    appointmentRemindersEnabled: text("appointment_reminders_enabled")
      .notNull()
      .default("true"),
    appointmentReminder72hEnabled: text("appointment_reminder_72h_enabled")
      .notNull()
      .default("false"),
    missedRecoveryEnabled: text("missed_recovery_enabled")
      .notNull()
      .default("true"),
    postVisitFollowUpEnabled: text("post_visit_follow_up_enabled")
      .notNull()
      .default("true"),
    inactivityWinbackEnabled: text("inactivity_winback_enabled")
      .notNull()
      .default("true"),
    loyaltyUnlockEnabled: text("loyalty_unlock_enabled")
      .notNull()
      .default("true"),
    inactivityDays: integer("inactivity_days").notNull().default(60),
    autoSendChannel: text("auto_send_channel").notNull().default("sms"),
    messageTemplates: jsonb("message_templates")
      .$type<
        Partial<
          Record<
            | "appointment_confirmation"
            | "appointment_reminder_24h"
            | "appointment_reminder_72h"
            | "missed_recovery"
            | "post_visit_followup"
            | "inactivity_winback"
            | "loyalty_unlock",
            { sms?: string; email?: string }
          >
        >
      >()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("automation_settings_business_id_unique").on(t.businessId)],
);

// Message events — audit log for sent/skipped automated messages
export const messageEvents = pgTable(
  "message_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    automationKey: text("automation_key").notNull(),
    purpose: messagePurposeEnum("purpose").notNull(),
    channel: messageChannelEnum("channel").notNull(),
    content: text("content").notNull(),
    status: messageEventStatusEnum("status").notNull().default("queued"),
    deliveryStatus: deliveryStatusEnum("delivery_status"),
    retryCount: integer("retry_count").notNull().default(0),
    provider: text("provider"),
    providerMetadata: jsonb("provider_metadata"),
    costMicros: integer("cost_micros"),
    providerMessageId: text("provider_message_id"),
    failureReason: text("failure_reason"),
    sentBy: text("sent_by").notNull().default("auto_tyvera"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("message_events_customer_id_created_at_idx").on(
      t.customerId,
      t.createdAt,
    ),
    index("message_events_provider_message_id_idx").on(t.providerMessageId),
  ],
);

export const manualFollowUpTasks = pgTable(
  "manual_follow_up_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    originalMessageEventId: uuid("original_message_event_id")
      .notNull()
      .references(() => messageEvents.id, { onDelete: "cascade" })
      .unique(),
    retryMessageEventId: uuid("retry_message_event_id").references(
      () => messageEvents.id,
      { onDelete: "set null" },
    ),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    status: manualFollowUpStatusEnum("status").notNull().default("open"),
    recipientMobile: text("recipient_mobile").notNull(),
    messageBody: text("message_body").notNull(),
    manualRetryRawMessage: text("manual_retry_raw_message").notNull(),
    failureReason: text("failure_reason").notNull(),
    notifiedAt: timestamp("notified_at"),
    resolvedAt: timestamp("resolved_at"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("manual_follow_up_tasks_org_status_created_idx").on(
      t.organizationId,
      t.status,
      t.createdAt,
    ),
    index("manual_follow_up_tasks_business_status_created_idx").on(
      t.businessId,
      t.status,
      t.createdAt,
    ),
    index("manual_follow_up_tasks_notified_idx").on(t.notifiedAt),
  ],
);

// SMS credits — per org, monthly allocation and usage
export const smsCredits = pgTable(
  "sms_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // YYYY-MM
    included: integer("included").notNull().default(0),
    addon: integer("addon").notNull().default(0),
    used: integer("used").notNull().default(0),
    pausedReason: smsPausedReasonEnum("paused_reason")
      .notNull()
      .default("none"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("sms_credits_org_month_unique").on(t.organizationId, t.month)],
);

// SMS usage events — per send, links to message_event
export const smsUsageEvents = pgTable("sms_usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageEventId: uuid("message_event_id")
    .notNull()
    .references(() => messageEvents.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  units: integer("units").notNull().default(1),
  status: text("status").notNull().default("consumed"),
  costMicros: integer("cost_micros"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email credits — per org, monthly allocation and usage
export const emailCredits = pgTable(
  "email_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // YYYY-MM
    included: integer("included").notNull().default(0),
    used: integer("used").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("email_credits_org_month_unique").on(t.organizationId, t.month)],
);

// Email usage events — per send, links to message_event
export const emailUsageEvents = pgTable("email_usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageEventId: uuid("message_event_id")
    .notNull()
    .references(() => messageEvents.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  units: integer("units").notNull().default(1),
  status: text("status").notNull().default("consumed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// SMS add-ons — purchased packs, consumed oldest first
export const smsAddons = pgTable(
  "sms_addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    packSize: integer("pack_size").notNull(),
    packPricePhp: integer("pack_price_php").notNull(),
    source: text("source").notNull().default("lemonsqueezy"),
    sourceReference: text("source_reference"),
    purchasedByUserId: uuid("purchased_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
    consumedUnits: integer("consumed_units").notNull().default(0),
    refundedUnits: integer("refunded_units").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique("sms_addons_source_reference_unique").on(
      t.source,
      t.sourceReference,
    ),
    index("sms_addons_organization_idx").on(t.organizationId),
  ],
);

// Verified online-booking OTP credits — monthly included + purchased add-ons
export const verifiedOnlineBookingCredits = pgTable(
  "verified_online_booking_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    includedGranted: integer("included_granted").notNull().default(0),
    addonGranted: integer("addon_granted").notNull().default(0),
    used: integer("used").notNull().default(0),
    sourcePlan: planTypeEnum("source_plan").notNull().default("free"),
    pausedReason: smsPausedReasonEnum("paused_reason")
      .notNull()
      .default("none"),
    lastReconciledAt: timestamp("last_reconciled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    unique("verified_online_booking_credits_org_month_unique").on(
      t.organizationId,
      t.month,
    ),
  ],
);

export const verifiedOnlineBookingUsageEvents = pgTable(
  "verified_online_booking_usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    bookingHoldId: uuid("booking_hold_id")
      .notNull()
      .references(() => bookingHolds.id, { onDelete: "cascade" }),
    units: integer("units").notNull().default(1),
    status: text("status").notNull().default("consumed"),
    provider: text("provider").notNull().default("twilio_verify"),
    providerVerificationSid: text("provider_verification_sid"),
    estimatedCostMicros: integer("estimated_cost_micros"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("verified_online_booking_usage_events_org_idx").on(t.organizationId),
    index("verified_online_booking_usage_events_business_idx").on(t.businessId),
    index("verified_online_booking_usage_events_hold_idx").on(t.bookingHoldId),
    index("verified_online_booking_usage_events_provider_sid_idx").on(
      t.providerVerificationSid,
    ),
  ],
);

export const publicOtpSendEvents = pgTable(
  "public_otp_send_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    bookingHoldId: uuid("booking_hold_id")
      .notNull()
      .references(() => bookingHolds.id, { onDelete: "cascade" }),
    mobile: text("mobile").notNull(),
    ipAddress: text("ip_address"),
    outcome: text("outcome").notNull(),
    provider: text("provider").notNull().default("twilio_verify"),
    providerVerificationSid: text("provider_verification_sid"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("public_otp_send_events_org_idx").on(t.organizationId),
    index("public_otp_send_events_business_idx").on(t.businessId),
    index("public_otp_send_events_hold_idx").on(t.bookingHoldId),
    index("public_otp_send_events_mobile_idx").on(t.mobile),
    index("public_otp_send_events_created_at_idx").on(t.createdAt),
  ],
);

export const verifiedOnlineBookingAddons = pgTable(
  "verified_online_booking_addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    units: integer("units").notNull(),
    pricePhp: integer("price_php").notNull(),
    sku: text("sku").notNull(),
    providerOrderId: text("provider_order_id"),
    source: text("source").notNull().default("lemonsqueezy"),
    sourceReference: text("source_reference"),
    purchasedByUserId: uuid("purchased_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
    consumedUnits: integer("consumed_units").notNull().default(0),
    refundedUnits: integer("refunded_units").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique("verified_booking_addons_source_reference_unique").on(
      t.source,
      t.sourceReference,
    ),
    index("verified_booking_addons_organization_idx").on(t.organizationId),
  ],
);

export const manualBillingRequests = pgTable(
  "manual_billing_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    referenceNumber: text("reference_number").notNull(),
    status: manualBillingRequestStatusEnum("status")
      .notNull()
      .default("draft"),
    totalAmountPhp: integer("total_amount_php").notNull(),
    dueAt: timestamp("due_at"),
    notes: text("notes"),
    createdByPlatformAdminId: uuid("created_by_platform_admin_id").references(
      () => platformAdmins.id,
      { onDelete: "set null" },
    ),
    voidedByPlatformAdminId: uuid("voided_by_platform_admin_id").references(
      () => platformAdmins.id,
      { onDelete: "set null" },
    ),
    voidedAt: timestamp("voided_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    unique("manual_billing_requests_reference_number_unique").on(
      t.referenceNumber,
    ),
    index("manual_billing_requests_organization_idx").on(t.organizationId),
    index("manual_billing_requests_status_idx").on(t.status),
    index("manual_billing_requests_created_at_idx").on(t.createdAt),
  ],
);

export const clientBillingRequests = pgTable(
  "client_billing_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    kind: clientBillingRequestKindEnum("kind").notNull(),
    requestedPlanType: planTypeEnum("requested_plan_type"),
    requestedSku: text("requested_sku"),
    requestedQuantity: integer("requested_quantity"),
    note: text("note"),
    status: clientBillingRequestStatusEnum("status")
      .notNull()
      .default("submitted"),
    linkedBillingRequestId: uuid("linked_billing_request_id").references(
      () => manualBillingRequests.id,
      { onDelete: "set null" },
    ),
    reviewedByPlatformAdminId: uuid(
      "reviewed_by_platform_admin_id",
    ).references(() => platformAdmins.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at"),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("client_billing_requests_organization_idx").on(t.organizationId),
    index("client_billing_requests_status_idx").on(t.status),
    index("client_billing_requests_created_at_idx").on(t.createdAt),
  ],
);

export const manualBillingRequestItems = pgTable(
  "manual_billing_request_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingRequestId: uuid("billing_request_id")
      .notNull()
      .references(() => manualBillingRequests.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    purchaseKind: text("purchase_kind").notNull(),
    units: integer("units").notNull(),
    unitPricePhp: integer("unit_price_php").notNull(),
    quantity: integer("quantity").notNull(),
    totalAmountPhp: integer("total_amount_php").notNull(),
    planType: planTypeEnum("plan_type"),
    billingInterval: text("billing_interval"),
    coverageStartsAt: timestamp("coverage_starts_at"),
    coverageEndsAt: timestamp("coverage_ends_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("manual_billing_request_items_request_idx").on(t.billingRequestId),
  ],
);

export const manualPayments = pgTable(
  "manual_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingRequestId: uuid("billing_request_id")
      .notNull()
      .references(() => manualBillingRequests.id, { onDelete: "cascade" }),
    method: manualPaymentMethodEnum("method").notNull(),
    amountPhp: integer("amount_php").notNull(),
    status: manualPaymentStatusEnum("status").notNull().default("pending"),
    externalReference: text("external_reference"),
    proofUrl: text("proof_url"),
    notes: text("notes"),
    recordedByPlatformAdminId: uuid("recorded_by_platform_admin_id").references(
      () => platformAdmins.id,
      { onDelete: "set null" },
    ),
    verifiedByPlatformAdminId: uuid("verified_by_platform_admin_id").references(
      () => platformAdmins.id,
      { onDelete: "set null" },
    ),
    verifiedAt: timestamp("verified_at"),
    rejectedByPlatformAdminId: uuid("rejected_by_platform_admin_id").references(
      () => platformAdmins.id,
      { onDelete: "set null" },
    ),
    rejectedAt: timestamp("rejected_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("manual_payments_request_idx").on(t.billingRequestId),
    index("manual_payments_status_idx").on(t.status),
  ],
);

export const manualBillingFulfillments = pgTable(
  "manual_billing_fulfillments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingRequestItemId: uuid("billing_request_item_id")
      .notNull()
      .references(() => manualBillingRequestItems.id, { onDelete: "cascade" }),
    manualPaymentId: uuid("manual_payment_id")
      .notNull()
      .references(() => manualPayments.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    purchaseKind: text("purchase_kind").notNull(),
    units: integer("units").notNull(),
    source: text("source").notNull().default("manual_payment"),
    sourceReference: text("source_reference").notNull(),
    fulfilledByPlatformAdminId: uuid(
      "fulfilled_by_platform_admin_id",
    ).references(() => platformAdmins.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique("manual_billing_fulfillments_item_unique").on(
      t.billingRequestItemId,
    ),
    unique("manual_billing_fulfillments_source_reference_unique").on(
      t.source,
      t.sourceReference,
    ),
    index("manual_billing_fulfillments_payment_idx").on(t.manualPaymentId),
  ],
);

export const manualBillingEmailDeliveries = pgTable(
  "manual_billing_email_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingRequestId: uuid("billing_request_id")
      .notNull()
      .references(() => manualBillingRequests.id, { onDelete: "cascade" }),
    manualPaymentId: uuid("manual_payment_id").references(
      () => manualPayments.id,
      { onDelete: "set null" },
    ),
    kind: text("kind").notNull(),
    recipientEmail: text("recipient_email"),
    status: text("status").notNull(),
    clientRef: text("client_ref").notNull(),
    providerMessageId: text("provider_message_id"),
    failureReason: text("failure_reason"),
    attemptedByPlatformAdminId: uuid(
      "attempted_by_platform_admin_id",
    ).references(() => platformAdmins.id, { onDelete: "set null" }),
    attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    unique("manual_billing_email_deliveries_client_ref_unique").on(
      t.clientRef,
    ),
    index("manual_billing_email_deliveries_request_idx").on(
      t.billingRequestId,
    ),
    index("manual_billing_email_deliveries_status_idx").on(t.status),
  ],
);

// Consent audit logs — when/why consent changed
export const consentAuditLogs = pgTable("consent_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  purpose: text("purpose").notNull(),
  before: text("before").notNull(),
  after: text("after").notNull(),
  source: text("source").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Audit logs — actions for compliance (no raw PII)
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Processed webhook events — provider-aware idempotency + audit envelope
export const processedWebhookEvents = pgTable(
  "processed_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull().unique(),
    provider: text("provider").notNull().default("lemonsqueezy"),
    eventName: text("event_name"),
    payloadHash: text("payload_hash"),
    status: text("status").notNull().default("processed"),
    failureReason: text("failure_reason"),
    retryCount: integer("retry_count").notNull().default(0),
    metadata: jsonb("metadata"),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at").defaultNow().notNull(),
  },
);

export const automationJobRuns = pgTable(
  "automation_job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobKey: text("job_key").notNull(),
    status: automationJobRunStatusEnum("status").notNull().default("running"),
    processedCount: integer("processed_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
    errorSummary: jsonb("error_summary"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("automation_job_runs_job_key_started_at_idx").on(
      t.jobKey,
      t.startedAt,
    ),
  ],
);

export const providerHealthSnapshots = pgTable(
  "provider_health_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    creditBalance: integer("credit_balance"),
    metrics: jsonb("metrics"),
    observedAt: timestamp("observed_at").defaultNow().notNull(),
  },
  (t) => [
    index("provider_health_snapshots_provider_observed_at_idx").on(
      t.provider,
      t.observedAt,
    ),
  ],
);

export const operationsAlerts = pgTable(
  "operations_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertKey: text("alert_key").notNull(),
    severity: operationsAlertSeverityEnum("severity").notNull(),
    status: operationsAlertStatusEnum("status").notNull().default("open"),
    provider: text("provider"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    metadata: jsonb("metadata"),
    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    acknowledgedAt: timestamp("acknowledged_at"),
    resolvedAt: timestamp("resolved_at"),
    acknowledgedByPlatformAdminId: uuid(
      "acknowledged_by_platform_admin_id",
    ).references(() => platformAdmins.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("operations_alerts_status_detected_at_idx").on(
      t.status,
      t.detectedAt,
    ),
  ],
);

export const creditReconciliationEvents = pgTable("credit_reconciliation_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  creditType: text("credit_type").notNull(),
  month: text("month").notNull(),
  eventType: text("event_type").notNull(),
  previousPlan: planTypeEnum("previous_plan"),
  nextPlan: planTypeEnum("next_plan"),
  includedBefore: integer("included_before").notNull().default(0),
  includedAfter: integer("included_after").notNull().default(0),
  addonBefore: integer("addon_before").notNull().default(0),
  addonAfter: integer("addon_after").notNull().default(0),
  usedBefore: integer("used_before").notNull().default(0),
  usedAfter: integer("used_after").notNull().default(0),
  providerEventId: text("provider_event_id"),
  metadata: jsonb("metadata"),
  resolvedAt: timestamp("resolved_at"),
  resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Privacy requests — DPA data subject requests
export const privacyRequests = pgTable("privacy_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // access, correction, deletion
  status: text("status").notNull().default("pending"),
  requestedBy: uuid("requested_by").references(() => users.id, {
    onDelete: "set null",
  }),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
