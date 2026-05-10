CREATE TABLE "assistant_thread_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"thread_id" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"last_turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_thread_memories_unique" UNIQUE("organization_id","user_id","thread_id")
);
--> statement-breakpoint
ALTER TABLE "assistant_thread_memories" ADD CONSTRAINT "assistant_thread_memories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;