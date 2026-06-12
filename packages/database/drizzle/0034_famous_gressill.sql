CREATE TABLE "manual_billing_email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_request_id" uuid NOT NULL,
	"manual_payment_id" uuid,
	"kind" text NOT NULL,
	"recipient_email" text,
	"status" text NOT NULL,
	"client_ref" text NOT NULL,
	"provider_message_id" text,
	"failure_reason" text,
	"attempted_by_platform_admin_id" uuid,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "manual_billing_email_deliveries_client_ref_unique" UNIQUE("client_ref")
);
--> statement-breakpoint
ALTER TABLE "manual_billing_email_deliveries" ADD CONSTRAINT "manual_billing_email_deliveries_billing_request_id_manual_billing_requests_id_fk" FOREIGN KEY ("billing_request_id") REFERENCES "public"."manual_billing_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_billing_email_deliveries" ADD CONSTRAINT "manual_billing_email_deliveries_manual_payment_id_manual_payments_id_fk" FOREIGN KEY ("manual_payment_id") REFERENCES "public"."manual_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_billing_email_deliveries" ADD CONSTRAINT "manual_billing_email_deliveries_attempted_by_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("attempted_by_platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manual_billing_email_deliveries_request_idx" ON "manual_billing_email_deliveries" USING btree ("billing_request_id");--> statement-breakpoint
CREATE INDEX "manual_billing_email_deliveries_status_idx" ON "manual_billing_email_deliveries" USING btree ("status");