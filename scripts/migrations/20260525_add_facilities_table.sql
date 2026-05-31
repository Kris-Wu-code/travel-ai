-- Add facilities table for POIs such as restaurants, toilets, shops, museums, etc.
-- This complements buildings/roads/indoor_paths for scene navigation and in-area discovery.

BEGIN;

CREATE TABLE IF NOT EXISTS facilities (
  id BIGSERIAL PRIMARY KEY,
  osm_id BIGINT,
  name TEXT,
  category TEXT,
  subtype TEXT,
  description TEXT,
  tags JSONB,
  images JSONB,
  source TEXT,
  geom GEOMETRY(Point, 4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facilities_geom ON facilities USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_facilities_osm_id ON facilities (osm_id);
CREATE INDEX IF NOT EXISTS idx_facilities_category ON facilities (category);

COMMIT;
