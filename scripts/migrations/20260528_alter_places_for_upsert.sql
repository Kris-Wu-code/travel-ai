-- Migration patch: make existing `places` compatible with API upsert workflow.
-- Safe to run multiple times.

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE IF EXISTS places
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS raw JSONB;

-- Optional: convert geometry(Point,4326) -> geography(Point,4326) when needed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'places'
      AND column_name = 'geom'
      AND udt_name = 'geometry'
  ) THEN
    ALTER TABLE places
      ALTER COLUMN geom TYPE GEOGRAPHY(Point, 4326)
      USING geom::geography;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_places_source_source_id_unique
  ON places (source, source_id)
  WHERE source IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_places_source_id
  ON places (source, source_id);

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

COMMIT;
