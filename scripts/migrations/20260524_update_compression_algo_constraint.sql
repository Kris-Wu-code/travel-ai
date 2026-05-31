-- Update compression_algo CHECK constraint to allow huffman variants
-- Run this migration in your Postgres/Supabase SQL editor.

BEGIN;

ALTER TABLE IF EXISTS diaries
  DROP CONSTRAINT IF EXISTS diaries_compression_algo_check;

ALTER TABLE IF EXISTS diaries
  ADD CONSTRAINT diaries_compression_algo_check
  CHECK (
    compression_algo IS NULL
    OR compression_algo IN ('none', 'huffman', 'huffman-v1')
  );

COMMIT;
