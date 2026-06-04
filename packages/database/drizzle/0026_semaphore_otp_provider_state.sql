ALTER TABLE "booking_holds"
ADD COLUMN IF NOT EXISTS "otp_provider" text,
ADD COLUMN IF NOT EXISTS "otp_code_hash" text,
ADD COLUMN IF NOT EXISTS "otp_code_expires_at" timestamp,
ADD COLUMN IF NOT EXISTS "otp_provider_message_id" text;

CREATE TABLE IF NOT EXISTS "otp_provider_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "provider" text DEFAULT 'twilio' NOT NULL,
  "switched_at" timestamp,
  "switch_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "otp_provider_settings_organization_unique" UNIQUE("organization_id")
);

CREATE INDEX IF NOT EXISTS "booking_holds_otp_provider_idx"
ON "booking_holds" ("otp_provider");

CREATE INDEX IF NOT EXISTS "otp_provider_settings_org_idx"
ON "otp_provider_settings" ("organization_id");
