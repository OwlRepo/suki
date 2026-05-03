ALTER TYPE "public"."plan_type" RENAME TO "plan_type_old";--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('starter', 'growth', 'pro');--> statement-breakpoint
ALTER TABLE "subscriptions"
  ALTER COLUMN "plan_type" TYPE "public"."plan_type"
  USING (
    CASE
      WHEN "plan_type"::text = 'ai_pro' THEN 'pro'
      ELSE "plan_type"::text
    END
  )::"public"."plan_type";--> statement-breakpoint
ALTER TABLE "organizations"
  ALTER COLUMN "current_plan" TYPE "public"."plan_type"
  USING (
    CASE
      WHEN "current_plan"::text = 'ai_pro' THEN 'pro'
      ELSE "current_plan"::text
    END
  )::"public"."plan_type";--> statement-breakpoint
DROP TYPE "public"."plan_type_old";
