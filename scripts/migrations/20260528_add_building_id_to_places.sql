-- Migration: add building_id and level columns to places for navigation linking
-- Safe to run multiple times.

BEGIN;

ALTER TABLE IF EXISTS places
  ADD COLUMN IF NOT EXISTS building_id UUID,
  ADD COLUMN IF NOT EXISTS level TEXT;

-- Optional FK: if you want DB-level referential integrity, uncomment below
-- ALTER TABLE IF EXISTS places
--   ADD CONSTRAINT IF NOT EXISTS fk_places_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL;

COMMIT;
