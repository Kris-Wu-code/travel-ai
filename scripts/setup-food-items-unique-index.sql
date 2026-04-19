-- Setup: enforce unique food item key per scene for stable upsert(name, scene_id)

-- 1) 清理历史重复数据：同名同场景只保留一条（按 id 字典序保留最小值）
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY name, scene_id
      ORDER BY id
    ) AS rn
  FROM public.food_items
)
DELETE FROM public.food_items f
USING ranked r
WHERE f.id = r.id
  AND r.rn > 1;

-- 2) 创建唯一索引：供 onConflict('name,scene_id') 使用
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_items_name_scene_id_unique
  ON public.food_items(name, scene_id);
