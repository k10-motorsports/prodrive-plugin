-- Theme Sets: support multiple named theme sets (e.g. F1 team liveries)
-- Each set has its own dark + light override layer on top of the base design tokens.

CREATE TABLE "theme_sets" (
	"slug" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"livery_image" text,
	"sort_order" integer NOT NULL DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Seed the default set first (existing rows need this for FK)
INSERT INTO "theme_sets" ("slug", "name", "description", "sort_order")
VALUES ('default', 'Default', 'The original K10 Motorsports dark/light theme', 0);
--> statement-breakpoint

-- Add set_slug to theme_overrides (default = 'default' for existing rows)
ALTER TABLE "theme_overrides" ADD COLUMN "set_slug" varchar(32) NOT NULL DEFAULT 'default';
--> statement-breakpoint

-- Drop old unique constraint and create new one that includes set_slug
ALTER TABLE "theme_overrides" DROP CONSTRAINT "theme_overrides_theme_id_token_path_unique";
--> statement-breakpoint
ALTER TABLE "theme_overrides" ADD CONSTRAINT "theme_overrides_set_slug_theme_id_token_path_unique" UNIQUE("set_slug", "theme_id", "token_path");
--> statement-breakpoint

-- FK from theme_overrides.set_slug → theme_sets.slug
ALTER TABLE "theme_overrides" ADD CONSTRAINT "theme_overrides_set_slug_theme_sets_slug_fk" FOREIGN KEY ("set_slug") REFERENCES "public"."theme_sets"("slug") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Add set_slug to token_builds (default = 'default' for existing rows)
ALTER TABLE "token_builds" ADD COLUMN "set_slug" varchar(32) NOT NULL DEFAULT 'default';
--> statement-breakpoint

-- FK from token_builds.set_slug → theme_sets.slug
ALTER TABLE "token_builds" ADD CONSTRAINT "token_builds_set_slug_theme_sets_slug_fk" FOREIGN KEY ("set_slug") REFERENCES "public"."theme_sets"("slug") ON DELETE cascade ON UPDATE no action;
