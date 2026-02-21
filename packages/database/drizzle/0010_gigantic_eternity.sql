CREATE TYPE "public"."delivery_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'bounced', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."sms_paused_reason" AS ENUM('none', 'cap_reached', 'billing_past_due', 'provider_down', 'manual_pause');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"before" text NOT NULL,
	"after" text NOT NULL,
	"source" text NOT NULL,
	"actor_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" uuid,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"pack_size" integer NOT NULL,
	"pack_price_php" integer NOT NULL,
	"purchased_by_user_id" uuid,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	"consumed_units" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"month" text NOT NULL,
	"included" integer DEFAULT 0 NOT NULL,
	"addon" integer DEFAULT 0 NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"paused_reason" "sms_paused_reason" DEFAULT 'none' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sms_credits_org_month_unique" UNIQUE("organization_id","month")
);
--> statement-breakpoint
CREATE TABLE "sms_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"units" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'consumed' NOT NULL,
	"cost_micros" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "email_opted_out_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "allow_transactional_email" text DEFAULT 'true' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "allow_promotional_email" text DEFAULT 'false' NOT NULL;--> statement-breakpoint
ALTER TABLE "message_events" ADD COLUMN "delivery_status" "delivery_status";--> statement-breakpoint
ALTER TABLE "message_events" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "message_events" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "message_events" ADD COLUMN "provider_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "message_events" ADD COLUMN "cost_micros" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "billing_failure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "grace_until" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "last_webhook_event_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "plan_price_php" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_audit_logs" ADD CONSTRAINT "consent_audit_logs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_audit_logs" ADD CONSTRAINT "consent_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_addons" ADD CONSTRAINT "sms_addons_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_addons" ADD CONSTRAINT "sms_addons_purchased_by_user_id_users_id_fk" FOREIGN KEY ("purchased_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_credits" ADD CONSTRAINT "sms_credits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_usage_events" ADD CONSTRAINT "sms_usage_events_message_event_id_message_events_id_fk" FOREIGN KEY ("message_event_id") REFERENCES "public"."message_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_usage_events" ADD CONSTRAINT "sms_usage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_usage_events" ADD CONSTRAINT "sms_usage_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;