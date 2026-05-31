-- Migration: create places/buildings/roads tables for PostGIS NOT available
-- Stores lat/lng columns and JSON metadata. PostGIS is recommended for spatial queries.

BEGIN;

CREATE TABLE IF NOT EXISTS places (
  id BIGSERIAL PRIMARY KEY,
  osm_id BIGINT,
  name TEXT,
  category TEXT,
  subtype TEXT,
  description TEXT,
  tags JSONB,
  images JSONB,
  source TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_places_lat_lng ON places (lat, lng);
CREATE INDEX IF NOT EXISTS idx_places_osm_id ON places (osm_id);

CREATE TABLE IF NOT EXISTS buildings (
  id BIGSERIAL PRIMARY KEY,
  osm_id BIGINT,
  name TEXT,
  kind TEXT,
  tags JSONB,
  centroid_lat DOUBLE PRECISION,
  centroid_lng DOUBLE PRECISION,
  entrance_points JSONB,
  levels TEXT,
  images JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roads (
  id BIGSERIAL PRIMARY KEY,
  osm_id BIGINT,
  highway_type TEXT,
  tags JSONB,
  geom_text TEXT, -- WKT-like or GeoJSON string for app-level processing
  length_m DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMIT;
