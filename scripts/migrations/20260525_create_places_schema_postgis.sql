-- Migration: create places/buildings/roads/indoor_paths tables using PostGIS
-- Run this in Supabase SQL editor if PostGIS is enabled (or run CREATE EXTENSION postgis first).

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

-- places: generic POIs
CREATE TABLE IF NOT EXISTS places (
  id BIGSERIAL PRIMARY KEY,
  osm_id BIGINT,
  source TEXT,
  source_id TEXT,
  building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
  name TEXT,
  category TEXT,
  subtype TEXT,
  description TEXT,
  tags JSONB,
  images JSONB,
  rating DOUBLE PRECISION,
  raw JSONB,
  geom GEOGRAPHY(Point, 4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (source, source_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'places' AND column_name = 'geom'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_places_geom ON places USING GIST (geom);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_places_osm_id ON places (osm_id);
CREATE INDEX IF NOT EXISTS idx_places_source_id ON places (source, source_id);
CREATE INDEX IF NOT EXISTS idx_places_building_id ON places (building_id);

-- buildings: polygons with optional entrance points
CREATE TABLE IF NOT EXISTS buildings (
  id BIGSERIAL PRIMARY KEY,
  osm_id BIGINT,
  name TEXT,
  kind TEXT,
  tags JSONB,
  geom GEOMETRY(Polygon, 4326),
  centroid GEOMETRY(Point, 4326),
  entrance_points JSONB,
  levels TEXT,
  images JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buildings' AND column_name = 'geom'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_buildings_geom ON buildings USING GIST (geom);
  END IF;
END $$;

-- roads: line strings (footways, paths, roads)
CREATE TABLE IF NOT EXISTS roads (
  id BIGSERIAL PRIMARY KEY,
  osm_id BIGINT,
  highway_type TEXT,
  tags JSONB,
  geom GEOMETRY(LINESTRING, 4326),
  length_m DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'roads' AND column_name = 'geom'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_roads_geom ON roads USING GIST (geom);
  END IF;
END $$;

-- indoor_paths: indoor navigation paths (per building, per level)
CREATE TABLE IF NOT EXISTS indoor_paths (
  id BIGSERIAL PRIMARY KEY,
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  level TEXT,
  tags JSONB,
  geom GEOMETRY(LINESTRING, 4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'indoor_paths' AND column_name = 'geom'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_indoor_paths_geom ON indoor_paths USING GIST (geom);
  END IF;
END $$;

COMMIT;
