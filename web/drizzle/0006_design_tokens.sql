CREATE TABLE "design_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" varchar(128) NOT NULL,
	"value" text NOT NULL,
	"kind" varchar(16) NOT NULL,
	"css_property" varchar(64) NOT NULL,
	"description" text,
	"wcag" varchar(32),
	"platforms" varchar(16) NOT NULL DEFAULT 'both',
	"category" varchar(32) NOT NULL,
	"sort_order" integer NOT NULL DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "design_tokens_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "theme_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theme_id" varchar(32) NOT NULL,
	"token_path" varchar(128) NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "theme_overrides_theme_id_token_path_unique" UNIQUE("theme_id","token_path")
);
--> statement-breakpoint
CREATE TABLE "token_builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theme_id" varchar(32) NOT NULL,
	"platform" varchar(16) NOT NULL,
	"blob_url" text NOT NULL,
	"hash" varchar(16) NOT NULL,
	"built_at" timestamp DEFAULT now() NOT NULL,
	"built_by" uuid
);
--> statement-breakpoint
ALTER TABLE "theme_overrides" ADD CONSTRAINT "theme_overrides_token_path_design_tokens_path_fk" FOREIGN KEY ("token_path") REFERENCES "public"."design_tokens"("path") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_builds" ADD CONSTRAINT "token_builds_built_by_users_id_fk" FOREIGN KEY ("built_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
