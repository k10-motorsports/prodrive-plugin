CREATE TABLE IF NOT EXISTS "track_maps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "track_id" varchar(128) NOT NULL UNIQUE,
  "track_name" varchar(256) NOT NULL,
  "svg_path" text NOT NULL,
  "point_count" integer NOT NULL,
  "raw_csv" text NOT NULL,
  "contributor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "game_name" varchar(64) DEFAULT 'iracing',
  "track_length_km" double precision,
  "svg_preview" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "track_maps_track_id_idx" ON "track_maps" ("track_id");
CREATE INDEX IF NOT EXISTS "track_maps_game_name_idx" ON "track_maps" ("game_name");
