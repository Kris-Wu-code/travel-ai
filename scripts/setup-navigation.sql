-- ============================================================================
-- Travel AI 导航系统数据库初始化脚本
-- 创建表：scene_pois, scene_routes, scene_floors
-- ============================================================================

-- 1. 场景内的 POI（兴趣点）表
CREATE TABLE IF NOT EXISTS public.scene_pois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL,
  name TEXT NOT NULL,
  poi_type TEXT NOT NULL,
  
  -- 空间位置信息
  floor INTEGER,                       -- NULL = 室外，1/2/3... = 室内楼层
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  
  -- 描述和元数据
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 约束
  UNIQUE(scene_id, name),
  CONSTRAINT scene_pois_scene_id_fk FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE CASCADE
);

-- 索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_scene_pois_scene_id ON public.scene_pois (scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_pois_scene_floor ON public.scene_pois (scene_id, floor);
CREATE INDEX IF NOT EXISTS idx_scene_pois_type ON public.scene_pois (scene_id, poi_type);

COMMENT ON TABLE public.scene_pois IS '场景内的 POI（兴趣点），用于路由网络的节点';
COMMENT ON COLUMN public.scene_pois.floor IS '楼层号：NULL=室外，1/2/3...=楼层';
COMMENT ON COLUMN public.scene_pois.poi_type IS '类型：entrance/canteen/toilet/classroom/office/library/restroom/parking';

-- 2. 路线边表（两个 POI 之间的连接）
CREATE TABLE IF NOT EXISTS public.scene_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL,
  
  start_poi_id UUID NOT NULL REFERENCES public.scene_pois(id) ON DELETE CASCADE,
  end_poi_id UUID NOT NULL REFERENCES public.scene_pois(id) ON DELETE CASCADE,
  
  -- 距离和时间属性
  distance_meters FLOAT NOT NULL,
  ideal_time_seconds FLOAT NOT NULL,
  
  -- 交通方式
  transport_type TEXT NOT NULL,        -- walk/bike/ev
  is_bidirectional BOOLEAN DEFAULT TRUE,
  
  -- 复杂性指标
  floor INTEGER,                       -- 如果不为 NULL，表示该路线在某个楼层内
  requires_elevator BOOLEAN DEFAULT FALSE,
  requires_stairs BOOLEAN DEFAULT FALSE,
  
  -- 动态属性
  congestion_factor FLOAT DEFAULT 1.0, -- 1.0=normal, 2.0=2x slower
  is_available BOOLEAN DEFAULT TRUE,
  
  -- 元数据
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 约束
  CONSTRAINT scene_routes_scene_id_fk FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE CASCADE,
  CONSTRAINT scene_routes_valid_time CHECK (ideal_time_seconds > 0),
  CONSTRAINT scene_routes_valid_distance CHECK (distance_meters > 0),
  CONSTRAINT scene_routes_valid_congestion CHECK (congestion_factor > 0)
);

-- 索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_scene_routes_scene_id ON public.scene_routes (scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_routes_start_poi ON public.scene_routes (start_poi_id);
CREATE INDEX IF NOT EXISTS idx_scene_routes_end_poi ON public.scene_routes (end_poi_id);
CREATE INDEX IF NOT EXISTS idx_scene_routes_available ON public.scene_routes (scene_id, is_available);

COMMENT ON TABLE public.scene_routes IS '导航路线边表，连接两个 POI，支持多种交通方式';
COMMENT ON COLUMN public.scene_routes.congestion_factor IS '拥堵系数：1.0 表示标准情况，>1.0 表示延迟';

-- 3. 楼层信息表（用于室内导航）
CREATE TABLE IF NOT EXISTS public.scene_floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL,
  floor INTEGER NOT NULL,
  floor_name TEXT,                     -- "一楼"、"二楼"、"B1地下室"
  
  -- 地图相关
  map_image_url TEXT,
  map_width_px INT,
  map_height_px INT,
  scale_meters_per_px FLOAT,           -- 1 像素 = 多少米
  
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 约束
  UNIQUE(scene_id, floor),
  CONSTRAINT scene_floors_scene_id_fk FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE CASCADE
);

-- 索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_scene_floors_scene_id ON public.scene_floors (scene_id);

COMMENT ON TABLE public.scene_floors IS '场景的楼层信息，用于室内导航';
COMMENT ON COLUMN public.scene_floors.scale_meters_per_px IS '地图像素比例：用于从图片坐标转换到实际距离';

-- ============================================================================
-- 权限配置（Supabase RLS）
-- ============================================================================

-- 启用 RLS
ALTER TABLE public.scene_pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_floors ENABLE ROW LEVEL SECURITY;

-- 所有用户可读取
CREATE POLICY "scene_pois_readable" ON public.scene_pois
  FOR SELECT USING (true);

CREATE POLICY "scene_routes_readable" ON public.scene_routes
  FOR SELECT USING (true);

CREATE POLICY "scene_floors_readable" ON public.scene_floors
  FOR SELECT USING (true);

-- 只有管理员可以写入（通过 service role key）
CREATE POLICY "scene_pois_writable" ON public.scene_pois
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "scene_routes_writable" ON public.scene_routes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "scene_floors_writable" ON public.scene_floors
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.scene_pois IS '✅ 初始化完成';
COMMENT ON TABLE public.scene_routes IS '✅ 初始化完成';
COMMENT ON TABLE public.scene_floors IS '✅ 初始化完成';
