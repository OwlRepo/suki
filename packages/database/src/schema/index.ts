import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  unique,
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
export const customers = pgTable("customers", {
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
export const appointments = pgTable("appointments", {
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
