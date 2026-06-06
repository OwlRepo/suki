CREATE TYPE "public"."manual_billing_request_status" AS ENUM('draft', 'awaiting_payment', 'payment_reported', 'paid_and_fulfilled', 'rejected', 'void');--> statement-breakpoint
CREATE TYPE "public"."manual_payment_method" AS ENUM('gcash', 'bank_transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."manual_payment_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "manual_billing_fulfillments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_request_item_id" uuid NOT NULL,
	"manual_payment_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"purchase_kind" text NOT NULL,
	"units" integer NOT NULL,
	"source" text DEFAULT 'manual_payment' NOT NULL,
	"source_reference" text NOT NULL,
	"fulfilled_by_platform_admin_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "manual_billing_fulfillments_item_unique" UNIQUE("billing_request_item_id"),
	CONSTRAINT "manual_billing_fulfillments_source_reference_unique" UNIQUE("source","source_reference")
);
--> statement-breakpoint
CREATE TABLE "manual_billing_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_request_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"purchase_kind" text NOT NULL,
	"units" integer NOT NULL,
	"unit_price_php" integer NOT NULL,
	"quantity" integer NOT NULL,
	"total_amount_php" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_billing_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference_number" text NOT NULL,
	"status" "manual_billing_request_status" DEFAULT 'draft' NOT NULL,
	"total_amount_php" integer NOT NULL,
	"due_at" timestamp,
	"notes" text,
	"created_by_platform_admin_id" uuid,
	"voided_by_platform_admin_id" uuid,
	"voided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "manual_billing_requests_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE TABLE "manual_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_request_id" uuid NOT NULL,
	"method" "manual_payment_method" NOT NULL,
	"amount_php" integer NOT NULL,
	"status" "manual_payment_status" DEFAULT 'pending' NOT NULL,
	"external_reference" text,
	"proof_url" text,
	"notes" text,
	"recorded_by_platform_admin_id" uuid,
	"verified_by_platform_admin_id" uuid,
	"verified_at" timestamp,
	"rejected_by_platform_admin_id" uuid,
	"rejected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_platform_admin_id" uuid,
	"actor_user_id" uuid,
	"organization_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sms_addons" ADD COLUMN "source" text DEFAULT 'lemonsqueezy' NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_addons" ADD COLUMN "source_reference" text;--> statement-breakpoint
ALTER TABLE "verified_online_booking_addons" ADD COLUMN "source" text DEFAULT 'lemonsqueezy' NOT NULL;--> statement-breakpoint
ALTER TABLE "verified_online_booking_addons" ADD COLUMN "source_reference" text;--> statement-breakpoint
ALTER TABLE "manual_billing_fulfillments" ADD CONSTRAINT "manual_billing_fulfillments_billing_request_item_id_manual_billing_request_items_id_fk" FOREIGN KEY ("billing_request_item_id") REFERENCES "public"."manual_billing_request_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_billing_fulfillments" ADD CONSTRAINT "manual_billing_fulfillments_manual_payment_id_manual_payments_id_fk" FOREIGN KEY ("manual_payment_id") REFERENCES "public"."manual_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_billing_fulfillments" ADD CONSTRAINT "manual_billing_fulfillments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_billing_fulfillments" ADD CONSTRAINT "manual_billing_fulfillments_fulfilled_by_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("fulfilled_by_platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_billing_request_items" ADD CONSTRAINT "manual_billing_request_items_billing_request_id_manual_billing_requests_id_fk" FOREIGN KEY ("billing_request_id") REFERENCES "public"."manual_billing_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_billing_requests" ADD CONSTRAINT "manual_billing_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_billing_requests" ADD CONSTRAINT "manual_billing_requests_created_by_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("created_by_platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_billing_requests" ADD CONSTRAINT "manual_billing_requests_voided_by_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("voided_by_platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_billing_request_id_manual_billing_requests_id_fk" FOREIGN KEY ("billing_request_id") REFERENCES "public"."manual_billing_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_recorded_by_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("recorded_by_platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_verified_by_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("verified_by_platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_rejected_by_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("rejected_by_platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_audit_logs" ADD CONSTRAINT "platform_admin_audit_logs_actor_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("actor_platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_audit_logs" ADD CONSTRAINT "platform_admin_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_audit_logs" ADD CONSTRAINT "platform_admin_audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manual_billing_fulfillments_payment_idx" ON "manual_billing_fulfillments" USING btree ("manual_payment_id");--> statement-breakpoint
CREATE INDEX "manual_billing_request_items_request_idx" ON "manual_billing_request_items" USING btree ("billing_request_id");--> statement-breakpoint
CREATE INDEX "manual_billing_requests_organization_idx" ON "manual_billing_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "manual_billing_requests_status_idx" ON "manual_billing_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "manual_billing_requests_created_at_idx" ON "manual_billing_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "manual_payments_request_idx" ON "manual_payments" USING btree ("billing_request_id");--> statement-breakpoint
CREATE INDEX "manual_payments_status_idx" ON "manual_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_admin_audit_logs_actor_idx" ON "platform_admin_audit_logs" USING btree ("actor_platform_admin_id");--> statement-breakpoint
CREATE INDEX "platform_admin_audit_logs_organization_idx" ON "platform_admin_audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "platform_admin_audit_logs_action_idx" ON "platform_admin_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "platform_admin_audit_logs_created_at_idx" ON "platform_admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sms_addons_organization_idx" ON "sms_addons" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "verified_booking_addons_organization_idx" ON "verified_online_booking_addons" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "sms_addons" ADD CONSTRAINT "sms_addons_source_reference_unique" UNIQUE("source","source_reference");--> statement-breakpoint
ALTER TABLE "verified_online_booking_addons" ADD CONSTRAINT "verified_booking_addons_source_reference_unique" UNIQUE("source","source_reference");