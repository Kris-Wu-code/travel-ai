# 导航系统 - 快速开始指南

## 概述

Travel AI 的导航系统提供了完整的路由规划功能，支持：

- ✅ **最短路径** (Dijkstra) - 找到两点之间的最优路线
- ✅ **旅行商问题** (TSP) - 多点最优访问顺序
- ✅ **多楼层导航** - 室内楼梯/电梯支持
- ✅ **多种交通方式** - 步行、骑车、电动车
- ✅ **实时可用性** - 路由动态启用/禁用

## 第一步：设置数据库

### 1.1 创建数据库表

执行 SQL 初始化脚本：

```bash
# 手动方法：复制 scripts/setup-navigation.sql 的内容到 Supabase SQL 编辑器
# 或使用 CLI：
psql "postgresql://[user]:[password]@[host]/[database]" -f scripts/setup-navigation.sql
```

该脚本会创建：

- `scene_pois` - POI 数据表（地点）
- `scene_routes` - 路由表（连接）
- `scene_floors` - 楼层表（建筑信息）

### 1.2 验证数据库设置

```bash
npx tsx scripts/verify-navigation.ts --scene-id "campus-demo-001"
```

预期输出：

```
✅ 验证完全通过！数据质量优秀。
```

## 第二步：创建导航数据

### 2.1 准备模板

编辑 `scripts/seed-navigation.ts` 中的模板数据：

**Campus 模板示例：**

```typescript
const campusTemplate = {
  sceneId: 'campus-demo-001',
  sceneName: '示例校园',
  pois: [
    {
      id: 'poi-entrance-east',
      name: '东门',
      poiType: 'entrance',
      floor: null,
      lat: 30.2741,
      lng: 120.1551,
    },
    // 更多 POI...
  ],
  routes: [
    {
      startPoiId: 'poi-entrance-east',
      endPoiId: 'poi-plaza-center',
      distanceMeters: 150,
      idealTimeSeconds: 120,
      transportType: 'walk',
      bidirectional: true,
      congestionFactor: 1.0,
    },
    // 更多路由...
  ],
}
```

### 2.2 执行数据导入

```bash
# 导入 Campus 模板（校园场景）
npx tsx scripts/seed-navigation.ts --template=campus

# 导入 Scenic 模板（景区场景）
npx tsx scripts/seed-navigation.ts --template=scenic

# 或导入自定义场景（编辑脚本后）
npx tsx scripts/seed-navigation.ts --template=custom
```

预期输出：

```
✅ 场景 'campus-demo-001' 已创建
✅ 已插入 16 个 POI
✅ 已插入 10 条路由
✅ 已插入 3 个楼层信息
```

## 第三步：测试算法

### 3.1 运行 Dijkstra 测试

```bash
npx tsx scripts/test-navigation.ts --scene-id "campus-demo-001" --algorithm "dijkstra"
```

预期输出：

```
✅ 从 "东门" 到 "宿舍 A" 的最短路径
   路径: 东门 → 广场 → 宿舍 A
   距离: 450 米，3 跳
```

### 3.2 运行 TSP 测试

```bash
npx tsx scripts/test-navigation.ts --scene-id "campus-demo-001" --algorithm "tsp"
```

预期输出：

```
✅ 5 个节点的最优访问顺序
   路径: 东门 → 广场 → 宿舍 A → 食堂 → 图书馆
   总距离: 1200 米
```

### 3.3 运行全部测试

```bash
npx tsx scripts/test-navigation.ts --scene-id "campus-demo-001" --algorithm "all"
```

## 第四步：使用 API

### 4.1 最短路径 API

**请求：**

```bash
curl "http://localhost:3000/api/navigation?action=shortest-path&sceneId=campus-demo-001&startId=poi-entrance-east&endId=poi-dorm-a"
```

**响应：**

```json
{
  "sceneId": "campus-demo-001",
  "startPoi": {
    "id": "poi-entrance-east",
    "name": "东门",
    "poi_type": "entrance"
  },
  "endPoi": {
    "id": "poi-dorm-a",
    "name": "宿舍 A",
    "poi_type": "dorm"
  },
  "distance": 450,
  "estimatedTime": 300,
  "path": ["poi-entrance-east", "poi-plaza-center", "poi-dorm-a"],
  "pathDetails": [
    {
      "id": "poi-entrance-east",
      "name": "东门",
      "location": { "lat": 30.2741, "lng": 120.1551 }
    },
    // ...
  ]
}
```

### 4.2 TSP API

**请求：**

```bash
curl "http://localhost:3000/api/navigation?action=tsp&sceneId=campus-demo-001&poiIds=poi-entrance-east,poi-plaza-center,poi-dorm-a,poi-canteen"
```

**响应：**

```json
{
  "sceneId": "campus-demo-001",
  "totalDistance": 1200,
  "estimatedTime": 800,
  "path": [
    "poi-entrance-east",
    "poi-plaza-center",
    "poi-dorm-a",
    "poi-canteen"
  ],
  "pathDetails": [
    // ...
  ],
  "optimizationAlgorithm": "dynamic-programming-with-heuristics"
}
```

### 4.3 图表信息 API

**请求：**

```bash
curl "http://localhost:3000/api/navigation?action=graph-info&sceneId=campus-demo-001"
```

**响应：**

```json
{
  "sceneId": "campus-demo-001",
  "stats": {
    "totalPois": 16,
    "totalRoutes": 10,
    "poiTypes": ["entrance", "dorm", "canteen", "classroom"],
    "floors": [1, 2, -1]
  },
  "pois": [
    // ...
  ],
  "routes": [
    // ...
  ]
}
```

## 自定义导航数据

### 如何添加自己的场景

1. **编辑 `scripts/seed-navigation.ts`**

```typescript
const mySceneTemplate = {
  sceneId: 'my-scene-001',
  sceneName: '我的场景',
  pois: [
    // 添加你的 POI
  ],
  routes: [
    // 添加你的路由
  ],
  floors: [
    // 如果需要多楼层
  ],
}

// 在 seedNavigationData 中添加
await seedNavigationData(mySceneTemplate)
```

2. **POI 字段说明**

```typescript
{
  id: string              // 唯一标识符，格式：poi-[name]
  name: string            // 显示名称
  poiType: string         // 类型：entrance, classroom, dorm, canteen, library, etc.
  floor: number | null    // 楼层（null = 室外）
  lat: number             // 纬度
  lng: number             // 经度
}
```

3. **Route 字段说明**

```typescript
{
  startPoiId: string      // 起点 POI ID
  endPoiId: string        // 终点 POI ID
  distanceMeters: number  // 路线距离（米）
  idealTimeSeconds: number // 理想行走时间（秒）
  transportType: string   // 交通方式：walk, bike, ev
  bidirectional: boolean  // 是否双向
  congestionFactor: number // 拥堵系数 (1.0 = 无拥堵)
  isAvailable: boolean    // 是否可用
}
```

## 故障排查

### 问题 1: 没有找到路径

**原因：** POI 不连通

**解决方案：**

1. 检查路由完整性：
   ```bash
   npx tsx scripts/verify-navigation.ts --scene-id "your-scene-id"
   ```

2. 查看 "孤立节点" 警告，添加缺失的路由

### 问题 2: 路径不是最优的

**原因：** 拥堵系数设置不当或路由权重不匹配

**解决方案：**

1. 检查所有路由的 `congestionFactor` 是否合理（0.5-5.0）
2. 验证距离计算是否正确

### 问题 3: TSP 性能不佳

**原因：** POI 数量过多（> 15）

**解决方案：**

1. 将大规模问题分解为子问题
2. 使用 `--algorithm=dijkstra` 进行中等规模导航
3. TSP 最适合 3-10 个节点

## 高级用法

### 多楼层导航

```typescript
// 创建楼层信息
const floor1 = {
  floor: 1,
  floorName: '一楼',
  mapImageUrl: 'https://example.com/floor1.png',
  scaleMetersPerPixel: 0.5,
}

// POI 指定楼层
const poi = {
  name: 'L1 教室',
  floor: 1,
  // ...
}

// 楼梯自动连接楼层
const stairRoute = {
  startPoiId: 'poi-classroom-l1',
  endPoiId: 'poi-classroom-l2',
  distanceMeters: 20, // 楼梯距离
  transportType: 'walk',
  // ...
}
```

### 动态启用/禁用路由

```typescript
// 更新路由（通过 Supabase）
await supabase
  .from('scene_routes')
  .update({ is_available: false })
  .eq('id', 'route-id')

// API 会自动排除禁用的路由
```

### 自定义拥堵系数

```typescript
// 高峰期增加拥堵
const peakHourRatio = 2.0 // 时间翻倍
const route = {
  congestionFactor: peakHourRatio,
  // ...
}
```

## 性能指标

| 场景 | POI 数量 | 路由数量 | Dijkstra 时间 | TSP 时间 | 备注 |
|------|---------|---------|--------------|---------|------|
| 校园 | 16 | 20 | < 5ms | < 50ms | 推荐 |
| 商城 | 30 | 50 | < 10ms | < 100ms | 可接受 |
| 景区 | 50 | 100 | < 20ms | > 1s | TSP 不推荐 |

## 相关文件

- 📄 [设置脚本](./scripts/setup-navigation.sql) - 数据库初始化
- 🔧 [导入脚本](./scripts/seed-navigation.ts) - 导入演示数据
- ✅ [验证脚本](./scripts/verify-navigation.ts) - 验证数据完整性
- 🧪 [测试脚本](./scripts/test-navigation.ts) - 算法测试
- 🌐 [API 路由](./app/api/navigation/route.ts) - REST API

## 后续步骤

1. ✅ 已完成：导航数据模型和算法
2. 📋 待实现：前端 UI 组件（地图可视化）
3. 📋 待实现：实时位置tracking
4. 📋 待实现：离线地图支持

---

**需要帮助？** 查看 [主要文档](../README.md) 或联系开发团队。
