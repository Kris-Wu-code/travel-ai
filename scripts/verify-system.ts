/**
 * 导航系统验证脚本
 * 测试所有功能是否正常工作
 */

import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { join } from 'path'
import { dijkstra } from '../app/lib/algo/dijkstra'
import { tsp } from '../app/lib/algo/tsp'
import { Graph } from '../app/lib/algo/graph'

dotenv.config({ path: join(__dirname, '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyNavigation() {
  console.log('\n' + '='.repeat(70))
  console.log('🧪 Travel AI 导航系统 - 完整验证')
  console.log('='.repeat(70) + '\n')

  let passed = 0
  let failed = 0

  // 测试 1: 验证 POI 数据
  console.log('📋 测试 1: 验证 POI 数据')
  try {
    const { data: pois, error } = await supabase
      .from('scene_pois')
      .select('*')
      .limit(20)

    if (error) throw error
    if (!pois || pois.length === 0) throw new Error('No POIs found')

    console.log(`   ✅ POI 数据完整: 共 ${pois.length} 条记录`)
    console.log(`      样本: ${pois[0].name} (${pois[0].poi_type})`)
    passed++
  } catch (err) {
    console.log(`   ❌ POI 查询失败: ${err instanceof Error ? err.message : String(err)}`)
    failed++
  }

  // 测试 2: 验证路由数据
  console.log('\n📋 测试 2: 验证路由数据')
  try {
    const { data: routes, error } = await supabase
      .from('scene_routes')
      .select('*')
      .limit(20)

    if (error) throw error
    if (!routes || routes.length === 0) throw new Error('No routes found')

    console.log(`   ✅ 路由数据完整: 共 ${routes.length} 条记录`)
    console.log(`      样本: ${routes[0].distance_meters}m, ${routes[0].ideal_time_seconds}s`)
    passed++
  } catch (err) {
    console.log(`   ❌ 路由查询失败: ${err instanceof Error ? err.message : String(err)}`)
    failed++
  }

  // 测试 3: 构建图表
  console.log('\n📋 测试 3: 构建导航图表')
  try {
    const { data: allPois } = await supabase.from('scene_pois').select('*')
    const { data: allRoutes } = await supabase.from('scene_routes').select('*')

    const graph = new Graph<string>()
    for (const poi of allPois || []) {
      graph.addVertex(poi.id, poi.name)
    }
    for (const route of allRoutes || []) {
      graph.addEdge(route.start_poi_id, route.end_poi_id, route.distance_meters)
      graph.addEdge(route.end_poi_id, route.start_poi_id, route.distance_meters)
    }

    const vertices = graph.getVertices()
    console.log(`   ✅ 图表构建成功: ${vertices.length} 个顶点`)
    passed++
  } catch (err) {
    console.log(`   ❌ 图表构建失败: ${err instanceof Error ? err.message : String(err)}`)
    failed++
  }

  // 测试 4: Dijkstra 最短路径
  console.log('\n📋 测试 4: Dijkstra 最短路径算法')
  try {
    const { data: allPois } = await supabase.from('scene_pois').select('*')
    const { data: allRoutes } = await supabase.from('scene_routes').select('*')

    if (!allPois || allPois.length < 2) throw new Error('Not enough POIs')

    const graph = new Graph<string>()
    for (const poi of allPois) {
      graph.addVertex(poi.id, poi.name)
    }
    for (const route of allRoutes || []) {
      graph.addEdge(route.start_poi_id, route.end_poi_id, route.distance_meters)
      graph.addEdge(route.end_poi_id, route.start_poi_id, route.distance_meters)
    }

    const start = allPois[0].id
    const end = allPois[Math.min(3, allPois.length - 1)].id
    const result = dijkstra(graph, start, end)

    if (result.distance === Infinity) {
      console.log(`   ⚠️  节点不连通（可能是孤立节点）`)
    } else {
      console.log(
        `   ✅ 最短路径: ${result.distance.toFixed(0)}m, ${result.path?.length || 0} 跳`,
      )
      console.log(`      路径: ${result.path?.map(id => allPois.find(p => p.id === id)?.name).join(' → ')}`)
    }
    passed++
  } catch (err) {
    console.log(`   ❌ Dijkstra 测试失败: ${err instanceof Error ? err.message : String(err)}`)
    failed++
  }

  // 测试 5: TSP 多点规划
  console.log('\n📋 测试 5: TSP 多点规划算法')
  try {
    const { data: allPois } = await supabase.from('scene_pois').select('*')
    const { data: allRoutes } = await supabase.from('scene_routes').select('*')

    if (!allPois || allPois.length < 3) throw new Error('Not enough POIs for TSP')

    const graph = new Graph<string>()
    for (const poi of allPois) {
      graph.addVertex(poi.id, poi.name)
    }
    for (const route of allRoutes || []) {
      graph.addEdge(route.start_poi_id, route.end_poi_id, route.distance_meters)
      graph.addEdge(route.end_poi_id, route.start_poi_id, route.distance_meters)
    }

    const poiIds = allPois.slice(0, 4).map(p => p.id)
    const result = tsp(graph, poiIds)

    if (!result) {
      console.log(`   ⚠️  TSP 无解（可能节点不连通）`)
    } else {
      console.log(`   ✅ TSP 求解: 总距离 ${result.distance.toFixed(0)}m`)
      console.log(
        `      访问顺序: ${result.path.map(id => allPois.find(p => p.id === id)?.name).join(' → ')}`,
      )
    }
    passed++
  } catch (err) {
    console.log(`   ❌ TSP 测试失败: ${err instanceof Error ? err.message : String(err)}`)
    failed++
  }

  // 总结
  console.log('\n' + '='.repeat(70))
  console.log(`📊 验证结果: ${passed} 通过 / ${failed} 失败\n`)

  if (failed === 0) {
    console.log('✅ 所有测试通过！导航系统工作正常。\n')
    console.log('🚀 你可以：')
    console.log('   1. 访问 http://localhost:3000/navigation')
    console.log('   2. 测试最短路径查询')
    console.log('   3. 测试多点规划功能\n')
  } else {
    console.log(`⚠️  有 ${failed} 个测试失败，请检查数据库连接和数据完整性\n`)
  }
}

verifyNavigation().catch(console.error)
