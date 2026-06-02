-- Automation schema: enums, automation_settings, message_events, appointments/customers extensions
CREATE TYPE "public"."message_purpose" AS ENUM('transactional', 'promotional');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."message_event_status" AS ENUM('queued', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "automation_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"appointment_reminders_enabled" text DEFAULT 'true' NOT NULL,
	"appointment_reminder_72h_enabled" text DEFAULT 'false' NOT NULL,
	"missed_recovery_enabled" text DEFAULT 'true' NOT NULL,
	"post_visit_follow_up_enabled" text DEFAULT 'true' NOT NULL,
	"inactivity_winback_enabled" text DEFAULT 'true' NOT NULL,
	"loyalty_unlock_enabled" text DEFAULT 'true' NOT NULL,
	"inactivity_days" integer DEFAULT 60 NOT NULL,
	"auto_send_channel" text DEFAULT 'sms' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "automation_settings_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "message_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"appointment_id" uuid,
	"automation_key" text NOT NULL,
	"purpose" "message_purpose" NOT NULL,
	"channel" "message_channel" NOT NULL,
	"content" text NOT NULL,
	"status" "message_event_status" DEFAULT 'queued' NOT NULL,
	"provider_message_id" text,
	"failure_reason" text,
	"sent_by" text DEFAULT 'auto_tyvera' NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "confirmation_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminder_24h_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminder_72h_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "missed_recovery_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "staff_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "post_visit_followup_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "inactivity_winback_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "loyalty_unlock_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "sms_opted_out_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "allow_transactional_sms" text DEFAULT 'true' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "allow_promotional_sms" text DEFAULT 'false' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "package_total_sessions" integer;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "package_remaining_sessions" integer;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "package_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "package_completed_notified_at" timestamp;--> statement-breakpoint
ALTER TABLE "automation_settings" ADD CONSTRAINT "automation_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_events" ADD CONSTRAINT "message_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_events" ADD CONSTRAINT "message_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_events" ADD CONSTRAINT "message_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_events_customer_id_created_at_idx" ON "message_events" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_scheduled_at_idx" ON "appointments" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_reminder_24h_sent_at_idx" ON "appointments" USING btree ("reminder_24h_sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_reminder_72h_sent_at_idx" ON "appointments" USING btree ("reminder_72h_sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_last_visit_at_idx" ON "customers" USING btree ("last_visit_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_inactivity_winback_sent_at_idx" ON "customers" USING btree ("inactivity_winback_sent_at");
