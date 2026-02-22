CREATE TABLE IF NOT EXISTS "customer_description_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_id" uuid,
	"business_type" text,
	"name" text NOT NULL,
	"fields_config" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_default_description_templates" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"template_id" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_description_templates" DROP CONSTRAINT IF EXISTS "customer_description_templates_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "customer_description_templates" DROP CONSTRAINT IF EXISTS "customer_description_templates_business_id_businesses_id_fk";--> statement-breakpoint
ALTER TABLE "customer_description_templates" ADD CONSTRAINT "customer_description_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_description_templates" ADD CONSTRAINT "customer_description_templates_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_default_description_templates" DROP CONSTRAINT IF EXISTS "business_default_description_templates_business_id_businesses_id_fk";--> statement-breakpoint
ALTER TABLE "business_default_description_templates" DROP CONSTRAINT IF EXISTS "business_default_description_templates_template_id_customer_description_templates_id_fk";--> statement-breakpoint
ALTER TABLE "business_default_description_templates" ADD CONSTRAINT "business_default_description_templates_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_default_description_templates" ADD CONSTRAINT "business_default_description_templates_template_id_customer_description_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."customer_description_templates"("id") ON DELETE cascade ON UPDATE no action;