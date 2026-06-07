CREATE TYPE "public"."automation_job_run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."operations_alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."operations_alert_status" AS ENUM('open', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TABLE "automation_job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_key" text NOT NULL,
	"status" "automation_job_run_status" DEFAULT 'running' NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"error_summary" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_key" text NOT NULL,
	"severity" "operations_alert_severity" NOT NULL,
	"status" "operations_alert_status" DEFAULT 'open' NOT NULL,
	"provider" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"acknowledged_by_platform_admin_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_health_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"credit_balance" integer,
	"metrics" jsonb,
	"observed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operations_alerts" ADD CONSTRAINT "operations_alerts_acknowledged_by_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("acknowledged_by_platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_job_runs_job_key_started_at_idx" ON "automation_job_runs" USING btree ("job_key","started_at");--> statement-breakpoint
CREATE INDEX "operations_alerts_status_detected_at_idx" ON "operations_alerts" USING btree ("status","detected_at");--> statement-breakpoint
CREATE INDEX "provider_health_snapshots_provider_observed_at_idx" ON "provider_health_snapshots" USING btree ("provider","observed_at");