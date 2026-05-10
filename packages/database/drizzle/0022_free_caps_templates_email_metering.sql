ALTER TABLE "automation_settings"
ADD COLUMN IF NOT EXISTS "message_templates" jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "email_credits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "month" text NOT NULL,
  "included" integer DEFAULT 0 NOT NULL,
  "used" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "email_credits_org_month_unique" UNIQUE("organization_id","month")
);

CREATE TABLE IF NOT EXISTS "email_usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_event_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "units" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'consumed' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "email_credits" ADD CONSTRAINT "email_credits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "email_usage_events" ADD CONSTRAINT "email_usage_events_message_event_id_message_events_id_fk" FOREIGN KEY ("message_event_id") REFERENCES "public"."message_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "email_usage_events" ADD CONSTRAINT "email_usage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "email_usage_events" ADD CONSTRAINT "email_usage_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
