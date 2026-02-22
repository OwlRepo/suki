CREATE TABLE "visit_adjustment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"before_count" integer NOT NULL,
	"after_count" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_user_id" uuid,
	"actor_clerk_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visit_adjustment_history" ADD CONSTRAINT "visit_adjustment_history_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_adjustment_history" ADD CONSTRAINT "visit_adjustment_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visit_adjustment_history_customer_id_idx" ON "visit_adjustment_history" USING btree ("customer_id");