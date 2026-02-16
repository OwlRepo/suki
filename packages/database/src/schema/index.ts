import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  pgEnum,
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
