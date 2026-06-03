ALTER TABLE "sms_addons"
ADD COLUMN IF NOT EXISTS "refunded_units" integer DEFAULT 0 NOT NULL;
