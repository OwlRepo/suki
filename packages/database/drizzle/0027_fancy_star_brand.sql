CREATE TYPE "public"."manual_follow_up_status" AS ENUM('open', 'contacted', 'dismissed');--> statement-breakpoint
CREATE TABLE "manual_follow_up_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"original_message_event_id" uuid NOT NULL,
	"retry_message_event_id" uuid,
	"customer_id" uuid NOT NULL,
	"appointment_id" uuid,
	"status" "manual_follow_up_status" DEFAULT 'open' NOT NULL,
	"recipient_mobile" text NOT NULL,
	"message_body" text NOT NULL,
	"manual_retry_raw_message" text NOT NULL,
	"failure_reason" text NOT NULL,
	"notified_at" timestamp,
	"resolved_at" timestamp,
	"resolved_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "manual_follow_up_tasks_original_message_event_id_unique" UNIQUE("original_message_event_id")
);
--> statement-breakpoint
ALTER TABLE "manual_follow_up_tasks" ADD CONSTRAINT "manual_follow_up_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_follow_up_tasks" ADD CONSTRAINT "manual_follow_up_tasks_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_follow_up_tasks" ADD CONSTRAINT "manual_follow_up_tasks_original_message_event_id_message_events_id_fk" FOREIGN KEY ("original_message_event_id") REFERENCES "public"."message_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_follow_up_tasks" ADD CONSTRAINT "manual_follow_up_tasks_retry_message_event_id_message_events_id_fk" FOREIGN KEY ("retry_message_event_id") REFERENCES "public"."message_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_follow_up_tasks" ADD CONSTRAINT "manual_follow_up_tasks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_follow_up_tasks" ADD CONSTRAINT "manual_follow_up_tasks_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_follow_up_tasks" ADD CONSTRAINT "manual_follow_up_tasks_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manual_follow_up_tasks_org_status_created_idx" ON "manual_follow_up_tasks" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "manual_follow_up_tasks_business_status_created_idx" ON "manual_follow_up_tasks" USING btree ("business_id","status","created_at");--> statement-breakpoint
CREATE INDEX "manual_follow_up_tasks_notified_idx" ON "manual_follow_up_tasks" USING btree ("notified_at");
