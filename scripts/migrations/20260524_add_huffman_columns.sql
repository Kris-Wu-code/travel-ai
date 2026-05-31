-- Add JSONB columns to store Huffman layout and code map for diary entries
ALTER TABLE IF EXISTS diaries
  ADD COLUMN IF NOT EXISTS huffman_layout jsonb,
  ADD COLUMN IF NOT EXISTS huffman_code_map jsonb;

-- Optional: create index for faster querying when visualizing
CREATE INDEX IF NOT EXISTS idx_diaries_huffman_layout ON diaries USING gin (huffman_layout jsonb_path_ops);
