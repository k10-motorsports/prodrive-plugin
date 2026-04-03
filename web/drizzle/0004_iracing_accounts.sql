CREATE TABLE IF NOT EXISTS "iracing_accounts" (
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

ALTER TABLE "iracing_accounts" ADD CONSTRAINT "iracing_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
