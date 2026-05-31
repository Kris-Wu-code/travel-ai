/**
 * 导航系统 Seed 脚本
 * 为新场景生成通用模板数据结构
 *
 * 使用方式：
 *   npx tsx scripts/seed-navigation.ts --scene-id "YOUR_SCENE_ID"
 *
 * 或直接运行 (使用内置的示例):
 *   npx tsx scripts/seed-navigation.ts
 */

import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { join } from 'path'

// 从项目根目录加载 .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 环境变量缺失！')
  console.error(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}`)
  console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseKey ? '✓' : '✗'}`)
  console.error('   请确保 .env.local 文件存在并包含这些变量')
  process.exit(1)
}

interface TemplateScene {
  sceneId: string
  sceneName: string
  description: string
  pois: Array<{
    name: string
    poiType: string
    floor: number | null
    latitude: number
    longitude: number
    description: string
  }>
  routes: Array<{
    startPoiName: string
    endPoiName: string
    distanceMeters: number
    transportType: string
    floor: number | null
    requiresElevator: boolean
    requiresStairs: boolean
  }>
  floors: Array<{
    floor: number
    floorName: string
    mapWidthPx?: number
    mapHeightPx?: number
    scaleMetersPerPx?: number
  }>
}

/**
 * 通用模板：校园导航示例
 * 包含基础 POI 和路线结构
 */
const campusTemplate: TemplateScene = {
  sceneId: 'campus-demo-001',
  sceneName: '示例校园',
  description: '通用校园导航模板（请根据实际情况修改）',
  
  pois: [
    // 室外入口
    { name: '东门', poiType: 'entrance', floor: null, latitude: 30.2741, longitude: 120.1551, description: '主校区东大门' },
    { name: '西门', poiType: 'entrance', floor: null, latitude: 30.2738, longitude: 120.1521, description: '主校区西大门' },
    { name: '南门', poiType: 'entrance', floor: null, latitude: 30.2720, longitude: 120.1540, description: '南校区南大门' },
    
    // 室外地标
    { name: '中心广场', poiType: 'landmark', floor: null, latitude: 30.2735, longitude: 120.1535, description: '校园中央广场' },
    { name: '宿舍楼A', poiType: 'dormitory', floor: null, latitude: 30.2745, longitude: 120.1545, description: '宿舍楼A主入口' },
    { name: '宿舍楼B', poiType: 'dormitory', floor: null, latitude: 30.2730, longitude: 120.1550, description: '宿舍楼B主入口' },
    
    // 食堂
    { name: '一号食堂', poiType: 'canteen', floor: 1, latitude: 30.2740, longitude: 120.1530, description: '主食堂一楼' },
    { name: '一号食堂二楼', poiType: 'canteen', floor: 2, latitude: 30.2740, longitude: 120.1530, description: '主食堂二楼' },
    
    // 教学楼
    { name: '教学楼1', poiType: 'classroom', floor: 1, latitude: 30.2738, longitude: 120.1538, description: '教学楼一楼大厅' },
    { name: '教室101', poiType: 'classroom', floor: 1, latitude: 30.2738, longitude: 120.1538, description: '教室101' },
    { name: '教室201', poiType: 'classroom', floor: 2, latitude: 30.2738, longitude: 120.1538, description: '教室201' },
    
    // 其他设施
    { name: '图书馆入口', poiType: 'library', floor: null, latitude: 30.2732, longitude: 120.1528, description: '校园图书馆' },
    { name: '运动场', poiType: 'sports', floor: null, latitude: 30.2725, longitude: 120.1520, description: '校园运动场' },
    { name: '医务室', poiType: 'medical', floor: 1, latitude: 30.2733, longitude: 120.1533, description: '校医院一楼' },
    
    // 楼梯/电梯（连接层级）
    { name: '1号楼梯间', poiType: 'stairs', floor: 1, latitude: 30.2738, longitude: 120.1535, description: '教学楼1号楼梯' },
    { name: '1号电梯', poiType: 'elevator', floor: 1, latitude: 30.2738, longitude: 120.1540, description: '教学楼1号电梯' },
  ],
  
  routes: [
    // 室外路线
    { startPoiName: '东门', endPoiName: '中心广场', distanceMeters: 500, transportType: 'walk', floor: null, requiresElevator: false, requiresStairs: false },
    { startPoiName: '中心广场', endPoiName: '西门', distanceMeters: 400, transportType: 'walk', floor: null, requiresElevator: false, requiresStairs: false },
    { startPoiName: '西门', endPoiName: '南门', distanceMeters: 600, transportType: 'walk', floor: null, requiresElevator: false, requiresStairs: false },
    
    // 宿舍连接
    { startPoiName: '中心广场', endPoiName: '宿舍楼A', distanceMeters: 300, transportType: 'walk', floor: null, requiresElevator: false, requiresStairs: false },
    { startPoiName: '宿舍楼A', endPoiName: '宿舍楼B', distanceMeters: 200, transportType: 'walk', floor: null, requiresElevator: false, requiresStairs: false },

    // 室外到室内的桥接路线
    { startPoiName: '中心广场', endPoiName: '一号食堂', distanceMeters: 350, transportType: 'walk', floor: null, requiresElevator: false, requiresStairs: false },
    
    // 食堂连接
    { startPoiName: '一号食堂', endPoiName: '教学楼1', distanceMeters: 250, transportType: 'walk', floor: 1, requiresElevator: false, requiresStairs: false },
    
    // 教学楼内部连接
    { startPoiName: '教学楼1', endPoiName: '教室101', distanceMeters: 50, transportType: 'walk', floor: 1, requiresElevator: false, requiresStairs: false },
    { startPoiName: '教室101', endPoiName: '1号楼梯间', distanceMeters: 30, transportType: 'walk', floor: 1, requiresElevator: false, requiresStairs: false },
    
    // 楼梯连接楼层
    { startPoiName: '1号楼梯间', endPoiName: '教室201', distanceMeters: 40, transportType: 'walk', floor: 2, requiresElevator: false, requiresStairs: true },
    
    // 电梯连接楼层
    { startPoiName: '1号电梯', endPoiName: '教室201', distanceMeters: 20, transportType: 'walk', floor: 2, requiresElevator: true, requiresStairs: false },
    
    // 自行车道
    { startPoiName: '东门', endPoiName: '图书馆入口', distanceMeters: 800, transportType: 'bike', floor: null, requiresElevator: false, requiresStairs: false },
    { startPoiName: '中心广场', endPoiName: '运动场', distanceMeters: 600, transportType: 'bike', floor: null, requiresElevator: false, requiresStairs: false },
  ],
  
  floors: [
    { floor: 1, floorName: '一楼', mapWidthPx: 1200, mapHeightPx: 800, scaleMetersPerPx: 0.5 },
    { floor: 2, floorName: '二楼', mapWidthPx: 1200, mapHeightPx: 800, scaleMetersPerPx: 0.5 },
    { floor: -1, floorName: '地下一楼', mapWidthPx: 1200, mapHeightPx: 800, scaleMetersPerPx: 0.5 },
  ],
}

/**
 * 另一个示例：景区导航
 */
const scenicTemplate: TemplateScene = {
  sceneId: 'scenic-demo-001',
  sceneName: '示例景区',
  description: '通用景区导航模板（请根据实际情况修改）',
  
  pois: [
    { name: '景区入口', poiType: 'entrance', floor: null, latitude: 30.2700, longitude: 120.1500, description: '主入口' },
    { name: '停车场', poiType: 'parking', floor: null, latitude: 30.2695, longitude: 120.1495, description: '游客停车场' },
    { name: '观景台A', poiType: 'viewpoint', floor: null, latitude: 30.2710, longitude: 120.1510, description: '东方观景台' },
    { name: '观景台B', poiType: 'viewpoint', floor: null, latitude: 30.2705, longitude: 120.1520, description: '西方观景台' },
    { name: '餐厅', poiType: 'canteen', floor: null, latitude: 30.2708, longitude: 120.1515, description: '景区餐厅' },
    { name: '取票处', poiType: 'office', floor: null, latitude: 30.2702, longitude: 120.1505, description: '门票服务点' },
  ],
  
  routes: [
    { startPoiName: '景区入口', endPoiName: '取票处', distanceMeters: 100, transportType: 'walk', floor: null, requiresElevator: false, requiresStairs: false },
    { startPoiName: '取票处', endPoiName: '观景台A', distanceMeters: 800, transportType: 'walk', floor: null, requiresElevator: false, requiresStairs: false },
    { startPoiName: '观景台A', endPoiName: '观景台B', distanceMeters: 1200, transportType: 'walk', floor: null, requiresElevator: false, requiresStairs: true },
    { startPoiName: '观景台B', endPoiName: '餐厅', distanceMeters: 500, transportType: 'walk', floor: null, requiresElevator: false, requiresStairs: false },
    { startPoiName: '景区入口', endPoiName: '停车场', distanceMeters: 200, transportType: 'walk', floor: null, requiresElevator: false, requiresStairs: false },
  ],
  
  floors: [],
}

async function seedNavigationData(template: TemplateScene) {
  const supabase = createClient(supabaseUrl!, supabaseKey!)

  console.log(`\n📍 开始导入导航数据: ${template.sceneName}`)
  console.log(`   场景名: ${template.sceneName}`)

  try {
    // 第一步：查找场景
    console.log('\n✓ 步骤 1: 查找场景...')
    const { data: sceneData, error: sceneError } = await supabase
      .from('scenes')
      .select('id, name')
      .eq('name', template.sceneName)
      .single()

    if (sceneError || !sceneData) {
      console.error(`❌ 场景不存在: ${template.sceneName}`)
      console.log(`   建议：请先运行 npx tsx scripts/create-scene.ts`)
      return false
    }
    
    const sceneId = sceneData.id
    console.log(`   ✅ 找到场景: ${sceneData.name}`)
    console.log(`   ID: ${sceneId}`)

    // 第二步：插入 POIs
    console.log('\n✓ 步骤 2: 插入 POI 数据...')
    const poiMap = new Map<string, string>() // POI 名称 → UUID
    let poiCount = 0

    for (const poi of template.pois) {
      const { data, error } = await supabase
        .from('scene_pois')
        .insert({
          scene_id: sceneId,
          name: poi.name,
          poi_type: poi.poiType,
          floor: poi.floor,
          latitude: poi.latitude,
          longitude: poi.longitude,
          description: poi.description,
          is_active: true,
        })
        .select('id')
        .single()

      if (error) {
        // 可能是唯一性约束冲突，尝试检索现有 POI
        const { data: existing } = await supabase
          .from('scene_pois')
          .select('id')
          .eq('scene_id', sceneId)
          .eq('name', poi.name)
          .single()

        if (existing) {
          poiMap.set(poi.name, existing.id)
          console.log(`   ⚠️  POI 已存在: ${poi.name}`)
          continue
        } else {
          console.error(`   ❌ 插入 POI 失败: ${poi.name}`, error.message)
          continue
        }
      }

      poiMap.set(poi.name, data.id)
      poiCount++
    }
    console.log(`   ✅ 插入 ${poiCount} 个 POI 数据`)

    // 第三步：插入路线
    console.log('\n✓ 步骤 3: 插入路线数据...')
    let routeCount = 0

    for (const route of template.routes) {
      const startPoiId = poiMap.get(route.startPoiName)
      const endPoiId = poiMap.get(route.endPoiName)

      if (!startPoiId || !endPoiId) {
        console.warn(`   ⚠️  找不到 POI: ${route.startPoiName} 或 ${route.endPoiName}`)
        continue
      }

      const { error } = await supabase
        .from('scene_routes')
        .insert({
          scene_id: sceneId,
          start_poi_id: startPoiId,
          end_poi_id: endPoiId,
          distance_meters: route.distanceMeters,
          ideal_time_seconds: Math.ceil(route.distanceMeters / 1.4), // 标准步行速度 1.4 m/s
          transport_type: route.transportType,
          is_bidirectional: true,
          floor: route.floor,
          requires_elevator: route.requiresElevator,
          requires_stairs: route.requiresStairs,
          congestion_factor: 1.0,
          is_available: true,
        })

      if (error) {
        console.error(
          `   ❌ 插入路线失败: ${route.startPoiName} → ${route.endPoiName}`,
          error.message,
        )
      } else {
        routeCount++
      }
    }
    console.log(`   ✅ 插入 ${routeCount} 条路线数据`)

    // 第四步：插入楼层
    console.log('\n✓ 步骤 4: 插入楼层数据...')
    let floorCount = 0

    for (const floor of template.floors) {
      const { error } = await supabase
        .from('scene_floors')
        .insert({
          scene_id: sceneId,
          floor: floor.floor,
          floor_name: floor.floorName,
          map_width_px: floor.mapWidthPx || 1200,
          map_height_px: floor.mapHeightPx || 800,
          scale_meters_per_px: floor.scaleMetersPerPx || 0.5,
        })

      if (error && !error.message.includes('duplicate')) {
        console.error(`   ❌ 插入楼层失败: ${floor.floorName}`, error.message)
      } else {
        floorCount++
      }
    }
    console.log(`   ✅ 插入 ${floorCount} 个楼层数据`)

    console.log(`\n✅ 导纳完成！\n`)
    console.log(`   场景 ID: ${sceneId}`)
    console.log(`   POI 数: ${poiCount}`)
    console.log(`   路线数: ${routeCount}`)
    console.log(`   楼层数: ${floorCount}`)

    return true
  } catch (error) {
    console.error('❌ 导入过程中发生错误:', error)
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  const templateArg = args.find(arg => arg.startsWith('--template='))
  const templateType = templateArg ? templateArg.split('=')[1] : 'campus'

  const template = templateType === 'scenic' ? scenicTemplate : campusTemplate

  console.log('\n' + '='.repeat(60))
  console.log('🎯 Travel AI 导航系统 - 通用模板数据生成')
  console.log('='.repeat(60))

  const success = await seedNavigationData(template)

  if (success) {
    console.log('\n💡 下一步：')
    console.log(`   1. 前往 http://localhost:3000/navigation 在导航页测试`)
    console.log('   2. 根据实际情况修改 POI 和路线数据')
    console.log('   3. 可以在 Supabase 管理后台直接编辑数据')
    console.log('\n📝 生成其他模板：')
    console.log('   npx tsx scripts/seed-navigation.ts --template=scenic')
  }

  process.exit(success ? 0 : 1)
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
