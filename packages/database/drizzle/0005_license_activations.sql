CREATE TABLE "license_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"machine_fingerprint" text,
	"license_payload" text,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"last_attestation_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL
);--> statement-breakpoint
ALTER TABLE "license_activations" ADD CONSTRAINT "license_activations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
