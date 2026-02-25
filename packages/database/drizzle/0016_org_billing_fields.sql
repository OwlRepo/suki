CREATE TYPE "public"."org_billing_status" AS ENUM('trial_active', 'trial_expired', 'active_manual', 'past_due_manual', 'cancelled_manual', 'suspended');--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "trial_starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "billing_status" "org_billing_status" DEFAULT 'trial_active';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "current_plan" "plan_type" DEFAULT 'starter';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "manual_billing_notes" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "last_billing_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "next_billing_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "billing_paused_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "access_ends_at" timestamp;--> statement-breakpoint
UPDATE "organizations" SET "trial_starts_at" = COALESCE("trial_starts_at", now()), "trial_ends_at" = COALESCE("trial_ends_at", now() + interval '30 days') WHERE "trial_starts_at" IS NULL OR "trial_ends_at" IS NULL;
