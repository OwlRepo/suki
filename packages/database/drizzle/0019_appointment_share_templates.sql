DO $$
BEGIN
  IF to_regclass('public.appointment_share_templates') IS NULL THEN
    CREATE TABLE "appointment_share_templates" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "business_id" uuid NOT NULL,
      "name" text NOT NULL,
      "slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "appointment_share_templates_business_name_unique" UNIQUE("business_id","name")
    );

    ALTER TABLE "appointment_share_templates"
      ADD CONSTRAINT "appointment_share_templates_business_id_businesses_id_fk"
      FOREIGN KEY ("business_id")
      REFERENCES "public"."businesses"("id")
      ON DELETE cascade
      ON UPDATE no action;
  END IF;
END
$$;
