CREATE TABLE "car_logos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_key" varchar(64) NOT NULL,
	"brand_name" varchar(128) NOT NULL,
	"logo_svg" text,
	"logo_png" text,
	"brand_color_hex" varchar(7),
	"contributor_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "car_logos_brand_key_unique" UNIQUE("brand_key")
);
--> statement-breakpoint
CREATE TABLE "iracing_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"iracing_cust_id" integer NOT NULL,
	"iracing_display_name" varchar(128),
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"last_import_at" timestamp,
	"import_status" varchar(16) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" varchar(128) NOT NULL,
	"track_name" varchar(256) NOT NULL,
	"display_name" varchar(256),
	"svg_path" text NOT NULL,
	"point_count" integer NOT NULL,
	"raw_csv" text NOT NULL,
	"contributor_id" uuid,
	"game_name" varchar(64) DEFAULT 'iracing',
	"track_length_km" double precision,
	"svg_preview" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "track_maps_track_id_unique" UNIQUE("track_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "custom_logo_url" text;--> statement-breakpoint
ALTER TABLE "car_logos" ADD CONSTRAINT "car_logos_contributor_id_users_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iracing_accounts" ADD CONSTRAINT "iracing_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_maps" ADD CONSTRAINT "track_maps_contributor_id_users_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;