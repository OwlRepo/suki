CREATE TABLE "booking_holds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "mobile" text NOT NULL,
  "scheduled_at" timestamp NOT NULL,
  "status" text DEFAULT 'held' NOT NULL,
  "otp_sid" text,
  "otp_attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp NOT NULL,
  "confirmed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_holds_business_scheduled_idx" ON "booking_holds" USING btree ("business_id","scheduled_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_holds_expires_at_idx" ON "booking_holds" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_holds_status_idx" ON "booking_holds" USING btree ("status");
