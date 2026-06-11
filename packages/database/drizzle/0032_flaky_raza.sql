ALTER TABLE "manual_billing_request_items" ADD COLUMN "plan_type" "plan_type";--> statement-breakpoint
ALTER TABLE "manual_billing_request_items" ADD COLUMN "billing_interval" text;--> statement-breakpoint
ALTER TABLE "manual_billing_request_items" ADD COLUMN "coverage_starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "manual_billing_request_items" ADD COLUMN "coverage_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "billing_contact_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "billing_contact_mobile" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "billing_contact_email" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "preferred_payment_method" "manual_payment_method";