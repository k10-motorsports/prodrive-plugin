-- Add logo columns to track_maps
ALTER TABLE track_maps ADD COLUMN IF NOT EXISTS logo_svg TEXT;
ALTER TABLE track_maps ADD COLUMN IF NOT EXISTS logo_png TEXT;
