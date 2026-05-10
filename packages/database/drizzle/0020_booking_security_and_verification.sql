DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_verification_mode') THEN
    CREATE TYPE "appointment_verification_mode" AS ENUM('otp_verified', 'pin_override');
  END IF;
END$$;

ALTER TABLE "appointments"
  ADD COLUMN "verification_mode" appointment_verification_mode NOT NULL DEFAULT 'otp_verified',
  ADD COLUMN "otp_skip_reason" text,
  ADD COLUMN "verified_by_user_id" uuid,
  ADD COLUMN "verified_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_verified_by_user_id_users_id_fk"
  FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

CREATE TABLE IF NOT EXISTS "booking_security_settings" (
  "business_id" uuid PRIMARY KEY NOT NULL,
  "otp_skip_pin_hash" text NOT NULL,
  "otp_skip_pin_set_by_user_id" uuid,
  "otp_skip_pin_set_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "booking_security_settings"
  ADD CONSTRAINT "booking_security_settings_business_id_businesses_id_fk"
  FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "booking_security_settings"
  ADD CONSTRAINT "booking_security_settings_otp_skip_pin_set_by_user_id_users_id_fk"
  FOREIGN KEY ("otp_skip_pin_set_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

CREATE TABLE IF NOT EXISTS "booking_pin_attempt_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "success" text DEFAULT 'false' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "booking_pin_attempt_logs"
  ADD CONSTRAINT "booking_pin_attempt_logs_business_id_businesses_id_fk"
  FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "booking_pin_attempt_logs"
  ADD CONSTRAINT "booking_pin_attempt_logs_actor_user_id_users_id_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "booking_pin_attempt_logs_business_user_created_idx"
  ON "booking_pin_attempt_logs" ("business_id", "actor_user_id", "created_at");
