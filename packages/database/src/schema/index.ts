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
export const planTypeEnum = pgEnum("plan_type", ["starter", "growth", "ai_pro"]);
export const userRoleEnum = pgEnum("user_role", ["owner", "staff"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "cancelled",
  "past_due",
  "trialing",
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
  "completed",
  "missed",
  "cancelled",
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

// Organizations — tenant for multi-business (future)
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Businesses — business profile, type, PayMongo customer id
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  ],
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
    status: appointmentStatusEnum("status").notNull().default("scheduled"),
    notes: text("notes"),
    confirmationSentAt: timestamp("confirmation_sent_at"),
    reminder24hSentAt: timestamp("reminder_24h_sent_at"),
    reminder72hSentAt: timestamp("reminder_72h_sent_at"),
    missedRecoverySentAt: timestamp("missed_recovery_sent_at"),
    staffName: text("staff_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("appointments_scheduled_at_idx").on(t.scheduledAt),
    index("appointments_reminder_24h_sent_at_idx").on(t.reminder24hSentAt),
    index("appointments_reminder_72h_sent_at_idx").on(t.reminder72hSentAt),
  ],
);

// Subscriptions — plan, status, PayMongo subscription id
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  planType: planTypeEnum("plan_type").notNull(),
  status: subscriptionStatusEnum("status").notNull(),
  paymongoSubscriptionId: text("paymongo_subscription_id"),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  billingFailureCount: integer("billing_failure_count").notNull().default(0),
  graceUntil: timestamp("grace_until"),
  lastWebhookEventId: text("last_webhook_event_id"),
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
    sentBy: text("sent_by").notNull().default("auto_suki"),
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

// SMS add-ons — purchased packs, consumed oldest first
export const smsAddons = pgTable("sms_addons", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  packSize: integer("pack_size").notNull(),
  packPricePhp: integer("pack_price_php").notNull(),
  purchasedByUserId: uuid("purchased_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  consumedUnits: integer("consumed_units").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

// Processed webhook events — idempotency for PayMongo webhooks
export const processedWebhookEvents = pgTable(
  "processed_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull().unique(),
    processedAt: timestamp("processed_at").defaultNow().notNull(),
  },
);

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
