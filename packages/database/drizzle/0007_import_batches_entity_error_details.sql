ALTER TABLE "import_batches" ADD COLUMN IF NOT EXISTS "entity_type" text DEFAULT 'contacts' NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN IF NOT EXISTS "error_details" jsonb DEFAULT '[]';
