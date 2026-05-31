-- Sample seed for places (OSM-style sample POI)
-- Run with psql or via Supabase SQL editor

INSERT INTO places (osm_id, source, source_id, name, category, tags, images, rating, raw, geom)
VALUES (
  123456789, -- osm_id
  'osm',
  'node/123456789',
  '示例咖啡馆',
  'cafe',
  '{"amenity": "cafe"}'::jsonb,
  '["https://example.com/image1.jpg"]'::jsonb,
  4.5,
  '{"osm_type":"node","tags":{"amenity":"cafe","name":"示例咖啡馆"}}'::jsonb,
  ST_SetSRID(ST_MakePoint(116.3976, 39.9087), 4326)::geography
);
