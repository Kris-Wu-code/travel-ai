-- Migration patch: backfill `places.building_id` from `places.raw._linked_building_id`.
-- Safe to run multiple times after `places.building_id` exists as UUID.

-- 说明：此迁移从 places.raw._linked_building_id 回填到 places.building_id。
-- 要点：
-- 1) 使用 IF NOT EXISTS 添加列，保证幂等；
-- 2) 仅在 raw 中存在 _linked_building_id 且值为合法 UUID 时回填，避免异常转换失败；
-- 3) 保持简单可重复执行（可在 Supabase SQL Editor 中手动运行）。

BEGIN;

ALTER TABLE IF EXISTS places
  ADD COLUMN IF NOT EXISTS building_id UUID;

-- 仅回填合法的 UUID 字符串，避免无效数据抛错
UPDATE places
SET building_id = (raw ->> '_linked_building_id')::UUID
WHERE building_id IS NULL
  AND raw ? '_linked_building_id'
  AND (raw ->> '_linked_building_id') ~ '^[0-9a-fA-F0-9]{8}-[0-9a-fA-F0-9]{4}-[0-9a-fA-F0-9]{4}-[0-9a-fA-F0-9]{4}-[0-9a-fA-F0-9]{12}$';

COMMENT ON COLUMN places.building_id IS 'Backfilled from raw->_linked_building_id; stores UUID linking to buildings.id';

COMMIT;
