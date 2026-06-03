CREATE TABLE "public_otp_send_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "booking_hold_id" uuid NOT NULL,
  "mobile" text NOT NULL,
  "ip_address" text,
  "outcome" text NOT NULL,
  "provider" text DEFAULT 'twilio_verify' NOT NULL,
  "provider_verification_sid" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "organizations"
  ALTER COLUMN "current_plan" SET DEFAULT 'free';
--> statement-breakpoint

ALTER TABLE "booking_holds"
  ADD COLUMN "otp_sent_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "otp_last_sent_at" timestamp,
  ADD COLUMN "otp_cooldown_ends_at" timestamp,
  ADD COLUMN "otp_send_window_key" text;
--> statement-breakpoint

ALTER TABLE "subscriptions"
  ADD COLUMN "pending_sync_action" text,
  ADD COLUMN "pending_sync_started_at" timestamp,
  ADD COLUMN "pending_sync_target_plan_type" "plan_type",
  ADD COLUMN "pending_sync_target_billing_interval" text;
--> statement-breakpoint

ALTER TABLE "credit_reconciliation_events"
  ADD COLUMN "resolved_at" timestamp,
  ADD COLUMN "resolved_by_user_id" uuid,
  ADD COLUMN "resolution_note" text;
--> statement-breakpoint

ALTER TABLE "verified_online_booking_credits"
  ALTER COLUMN "source_plan" SET DEFAULT 'free';
--> statement-breakpoint

ALTER TABLE "credit_reconciliation_events"
  ADD CONSTRAINT "credit_reconciliation_events_resolved_by_user_id_users_id_fk"
  FOREIGN KEY ("resolved_by_user_id")
  REFERENCES "public"."users"("id")
  ON DELETE set null
  ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "public_otp_send_events"
  ADD CONSTRAINT "public_otp_send_events_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id")
  REFERENCES "public"."organizations"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "public_otp_send_events"
  ADD CONSTRAINT "public_otp_send_events_business_id_businesses_id_fk"
  FOREIGN KEY ("business_id")
  REFERENCES "public"."businesses"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "public_otp_send_events"
  ADD CONSTRAINT "public_otp_send_events_booking_hold_id_booking_holds_id_fk"
  FOREIGN KEY ("booking_hold_id")
  REFERENCES "public"."booking_holds"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "public_otp_send_events_org_idx"
  ON "public_otp_send_events" USING btree ("organization_id");
--> statement-breakpoint

CREATE INDEX "public_otp_send_events_business_idx"
  ON "public_otp_send_events" USING btree ("business_id");
--> statement-breakpoint

CREATE INDEX "public_otp_send_events_hold_idx"
  ON "public_otp_send_events" USING btree ("booking_hold_id");
--> statement-breakpoint

CREATE INDEX "public_otp_send_events_mobile_idx"
  ON "public_otp_send_events" USING btree ("mobile");
--> statement-breakpoint

CREATE INDEX "public_otp_send_events_created_at_idx"
  ON "public_otp_send_events" USING btree ("created_at");
