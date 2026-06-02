ALTER TYPE "public"."plan_type" ADD VALUE IF NOT EXISTS 'free';
--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE IF NOT EXISTS 'paused';
--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE IF NOT EXISTS 'expired';
--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE IF NOT EXISTS 'unpaid';
--> statement-breakpoint
ALTER TYPE "public"."org_billing_status" ADD VALUE IF NOT EXISTS 'free_active';
--> statement-breakpoint
ALTER TYPE "public"."org_billing_status" ADD VALUE IF NOT EXISTS 'subscription_active';
--> statement-breakpoint
ALTER TYPE "public"."org_billing_status" ADD VALUE IF NOT EXISTS 'subscription_past_due';
--> statement-breakpoint
ALTER TYPE "public"."org_billing_status" ADD VALUE IF NOT EXISTS 'subscription_cancelled';
--> statement-breakpoint
ALTER TYPE "public"."org_billing_status" ADD VALUE IF NOT EXISTS 'subscription_expired';
--> statement-breakpoint
ALTER TYPE "public"."org_billing_status" ADD VALUE IF NOT EXISTS 'subscription_paused';
--> statement-breakpoint

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "provider" text,
  ADD COLUMN IF NOT EXISTS "provider_subscription_id" text,
  ADD COLUMN IF NOT EXISTS "provider_customer_id" text,
  ADD COLUMN IF NOT EXISTS "provider_order_id" text,
  ADD COLUMN IF NOT EXISTS "provider_product_id" text,
  ADD COLUMN IF NOT EXISTS "provider_variant_id" text,
  ADD COLUMN IF NOT EXISTS "provider_subscription_item_id" text,
  ADD COLUMN IF NOT EXISTS "billing_interval" text,
  ADD COLUMN IF NOT EXISTS "cancelled" text DEFAULT 'false' NOT NULL,
  ADD COLUMN IF NOT EXISTS "renews_at" timestamp,
  ADD COLUMN IF NOT EXISTS "ends_at" timestamp,
  ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp,
  ADD COLUMN IF NOT EXISTS "card_brand" text,
  ADD COLUMN IF NOT EXISTS "card_last_four" text,
  ADD COLUMN IF NOT EXISTS "update_payment_method_url" text,
  ADD COLUMN IF NOT EXISTS "customer_portal_url" text,
  ADD COLUMN IF NOT EXISTS "scheduled_plan_type" "plan_type",
  ADD COLUMN IF NOT EXISTS "scheduled_billing_interval" text,
  ADD COLUMN IF NOT EXISTS "scheduled_change_effective_at" timestamp,
  ADD COLUMN IF NOT EXISTS "last_provider_event_id" text;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_provider_subscription_id_unique"
  ON "subscriptions" ("provider_subscription_id")
  WHERE "provider_subscription_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_provider_order_id_unique"
  ON "subscriptions" ("provider_order_id")
  WHERE "provider_order_id" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "verified_online_booking_credits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "month" text NOT NULL,
  "included_granted" integer DEFAULT 0 NOT NULL,
  "addon_granted" integer DEFAULT 0 NOT NULL,
  "used" integer DEFAULT 0 NOT NULL,
  "source_plan" "plan_type" NOT NULL,
  "paused_reason" "sms_paused_reason" DEFAULT 'none' NOT NULL,
  "last_reconciled_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "verified_online_booking_credits_org_month_unique" UNIQUE("organization_id","month")
);
--> statement-breakpoint
ALTER TABLE "verified_online_booking_credits"
  ADD CONSTRAINT "verified_online_booking_credits_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "verified_online_booking_usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "booking_hold_id" uuid NOT NULL,
  "units" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'consumed' NOT NULL,
  "provider" text DEFAULT 'twilio_verify' NOT NULL,
  "provider_verification_sid" text,
  "estimated_cost_micros" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verified_online_booking_usage_events"
  ADD CONSTRAINT "verified_online_booking_usage_events_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "verified_online_booking_usage_events"
  ADD CONSTRAINT "verified_online_booking_usage_events_business_id_businesses_id_fk"
  FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "verified_online_booking_usage_events"
  ADD CONSTRAINT "verified_online_booking_usage_events_booking_hold_id_booking_holds_id_fk"
  FOREIGN KEY ("booking_hold_id") REFERENCES "public"."booking_holds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verified_online_booking_usage_events_org_idx"
  ON "verified_online_booking_usage_events" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verified_online_booking_usage_events_business_idx"
  ON "verified_online_booking_usage_events" ("business_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verified_online_booking_usage_events_hold_idx"
  ON "verified_online_booking_usage_events" ("booking_hold_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verified_online_booking_usage_events_provider_sid_idx"
  ON "verified_online_booking_usage_events" ("provider_verification_sid");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "verified_online_booking_addons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "units" integer NOT NULL,
  "price_php" integer NOT NULL,
  "sku" text NOT NULL,
  "provider_order_id" text,
  "purchased_by_user_id" uuid,
  "purchased_at" timestamp DEFAULT now() NOT NULL,
  "consumed_units" integer DEFAULT 0 NOT NULL,
  "refunded_units" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verified_online_booking_addons"
  ADD CONSTRAINT "verified_online_booking_addons_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "verified_online_booking_addons"
  ADD CONSTRAINT "verified_online_booking_addons_purchased_by_user_id_users_id_fk"
  FOREIGN KEY ("purchased_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "verified_online_booking_addons_provider_order_id_unique"
  ON "verified_online_booking_addons" ("provider_order_id")
  WHERE "provider_order_id" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "processed_webhook_events"
  ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'lemonsqueezy' NOT NULL,
  ADD COLUMN IF NOT EXISTS "event_name" text,
  ADD COLUMN IF NOT EXISTS "payload_hash" text,
  ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'processed' NOT NULL,
  ADD COLUMN IF NOT EXISTS "failure_reason" text,
  ADD COLUMN IF NOT EXISTS "retry_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb,
  ADD COLUMN IF NOT EXISTS "received_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "credit_reconciliation_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "credit_type" text NOT NULL,
  "month" text NOT NULL,
  "event_type" text NOT NULL,
  "previous_plan" "plan_type",
  "next_plan" "plan_type",
  "included_before" integer DEFAULT 0 NOT NULL,
  "included_after" integer DEFAULT 0 NOT NULL,
  "addon_before" integer DEFAULT 0 NOT NULL,
  "addon_after" integer DEFAULT 0 NOT NULL,
  "used_before" integer DEFAULT 0 NOT NULL,
  "used_after" integer DEFAULT 0 NOT NULL,
  "provider_event_id" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_reconciliation_events"
  ADD CONSTRAINT "credit_reconciliation_events_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
