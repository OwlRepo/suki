ALTER TYPE "public"."appointment_status" ADD VALUE 'checked_in' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."appointment_status" ADD VALUE 'needs_review' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "duration_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "checked_in_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "needs_review_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "visit_recorded_at" timestamp;--> statement-breakpoint
CREATE INDEX "appointments_status_scheduled_at_idx" ON "appointments" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "appointments_visit_recorded_at_idx" ON "appointments" USING btree ("visit_recorded_at");--> statement-breakpoint
CREATE INDEX "customers_business_mobile_idx" ON "customers" USING btree ("business_id","mobile");