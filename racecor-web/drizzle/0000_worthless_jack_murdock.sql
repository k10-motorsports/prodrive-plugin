CREATE TABLE "auth_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"code_challenge" varchar(128),
	"code_challenge_method" varchar(8),
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "driver_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" varchar(16) NOT NULL,
	"irating" integer DEFAULT 0 NOT NULL,
	"safety_rating" varchar(8) DEFAULT '0.00' NOT NULL,
	"license" varchar(4) DEFAULT 'R' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" varchar(128) NOT NULL,
	"refresh_token" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"device_name" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_tokens_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "plugin_tokens_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "race_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"car_model" varchar(128) NOT NULL,
	"manufacturer" varchar(64),
	"category" varchar(16) NOT NULL,
	"track_name" varchar(128),
	"session_type" varchar(32),
	"finish_position" integer,
	"incident_count" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" varchar(16) NOT NULL,
	"irating" integer NOT NULL,
	"safety_rating" varchar(8) NOT NULL,
	"license" varchar(4) NOT NULL,
	"prev_irating" integer,
	"prev_safety_rating" varchar(8),
	"prev_license" varchar(4),
	"session_type" varchar(32),
	"track_name" varchar(128),
	"car_model" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" varchar(32) NOT NULL,
	"discord_username" varchar(64) NOT NULL,
	"discord_display_name" varchar(64),
	"discord_avatar" text,
	"email" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
ALTER TABLE "auth_codes" ADD CONSTRAINT "auth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_ratings" ADD CONSTRAINT "driver_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_tokens" ADD CONSTRAINT "plugin_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_sessions" ADD CONSTRAINT "race_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;