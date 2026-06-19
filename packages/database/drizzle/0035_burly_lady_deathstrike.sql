CREATE TYPE "public"."client_billing_request_kind" AS ENUM('plan_change', 'sms_topup', 'cancellation');--> statement-breakpoint
CREATE TYPE "public"."client_billing_request_status" AS ENUM('submitted', 'under_review', 'approved', 'declined', 'cancelled');--> statement-breakpoint
CREATE TABLE "client_billing_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"kind" "client_billing_request_kind" NOT NULL,
	"requested_plan_type" "plan_type",
	"requested_sku" text,
	"requested_quantity" integer,
	"note" text,
	"status" "client_billing_request_status" DEFAULT 'submitted' NOT NULL,
	"linked_billing_request_id" uuid,
	"reviewed_by_platform_admin_id" uuid,
	"reviewed_at" timestamp,
	"decision_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_billing_requests" ADD CONSTRAINT "client_billing_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_billing_requests" ADD CONSTRAINT "client_billing_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_billing_requests" ADD CONSTRAINT "client_billing_requests_linked_billing_request_id_manual_billing_requests_id_fk" FOREIGN KEY ("linked_billing_request_id") REFERENCES "public"."manual_billing_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_billing_requests" ADD CONSTRAINT "client_billing_requests_reviewed_by_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("reviewed_by_platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_billing_requests_organization_idx" ON "client_billing_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "client_billing_requests_status_idx" ON "client_billing_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_billing_requests_created_at_idx" ON "client_billing_requests" USING btree ("created_at");