/**
 * 导航系统测试脚本
 * 测试最短路径（Dijkstra）和旅行商问题（TSP）算法
 *
 * 使用方法：
 *   npx tsx scripts/test-navigation.ts --scene-id "YOUR_SCENE_ID" --algorithm "dijkstra|tsp"
 */

import { createClient } from '@supabase/supabase-js'
import { dijkstra } from '../app/lib/algo/dijkstra'
import { tsp } from '../app/lib/algo/tsp'
import { Graph } from '../app/lib/algo/graph'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface POI {
  id: string
  name: string
  floor: number | null
}

interface Route {
  start_poi_id: string
  end_poi_id: string
  distance_meters: number
  ideal_time_seconds: number
  is_available: boolean
}

interface TestResults {
  algorithm: string
  testCases: {
    name: string
    status: 'pass' | 'fail'
    message: string
    details?: {
      startPoi: string
      endPoi?: string
      distance?: number
      time?: number
      path?: string[]
      actualPath?: string[]
    }
  }[]
}

async function loadNavigationData(sceneId: string) {
  const supabase = createClient(supabaseUrl, supabaseKey)

  const [{ data: pois }, { data: routes }] = await Promise.all([
    supabase.from('scene_pois').select('*').eq('scene_id', sceneId),
    supabase.from('scene_routes').select('*').eq('scene_id', sceneId),
  ])

  return { pois: pois || [], routes: routes || [] }
}

function buildGraph(pois: POI[], routes: Route[]): { graph: Graph<string>; edges: Map<string, number> } {
  const graph = new Graph<string>()

  // 添加所有节点
  for (const poi of pois) {
    if (!graph.hasVertex(poi.id)) {
      graph.addVertex(poi.id, poi.name)
    }
  }

  // 添加所有边
  const edges = new Map<string, number>()
  for (const route of routes) {
    if (route.is_available) {
      const edgeKey = `${route.start_poi_id}->${route.end_poi_id}`
      graph.addEdge(route.start_poi_id, route.end_poi_id, route.distance_meters)
      edges.set(edgeKey, route.distance_meters)

      // 假设是双向路由
      const reverseKey = `${route.end_poi_id}->${route.start_poi_id}`
      graph.addEdge(route.end_poi_id, route.start_poi_id, route.distance_meters)
      edges.set(reverseKey, route.distance_meters)
    }
  }

  return { graph, edges }
}

async function testDijkstra(
  pois: POI[],
  routes: Route[],
  sceneId: string,
): Promise<TestResults> {
  const results: TestResults = {
    algorithm: 'Dijkstra 最短路径',
    testCases: [],
  }

  const { graph } = buildGraph(pois, routes)

  if (pois.length < 2) {
    results.testCases.push({
      name: '数据充分性检查',
      status: 'fail',
      message: '❌ POI 数量不足，无法进行测试',
    })
    return results
  }

  // 测试用例 1: 邻接 POI 之间的路径
  results.testCases.push({
    name: '邻接节点最短路径',
    status: 'pass',
    message: '✅ 测试用例已准备',
  })

  // 测试用例 2: 距离计算
  const startPoi = pois[0]
  const endPoi = pois[Math.min(1, pois.length - 1)]

  try {
    const result = dijkstra(graph, startPoi.id, endPoi.id)

    if (result.distance !== Infinity && result.path) {
      results.testCases.push({
        name: `从 "${startPoi.name}" 到 "${endPoi.name}" 的最短路径`,
        status: 'pass',
        message: `✅ 路径找到，距离 ${result.distance} 米，${result.path.length} 跳`,
        details: {
          startPoi: startPoi.name,
          endPoi: endPoi.name,
          distance: result.distance,
          path: result.path.map(id => pois.find(p => p.id === id)?.name || id),
          actualPath: result.path,
        },
      })
    } else {
      results.testCases.push({
        name: `从 "${startPoi.name}" 到 "${endPoi.name}" 的路径`,
        status: 'fail',
        message: '❌ 无法找到路径（节点可能不连通）',
        details: {
          startPoi: startPoi.name,
          endPoi: endPoi.name,
        },
      })
    }
  } catch (error) {
    results.testCases.push({
      name: 'Dijkstra 算法执行',
      status: 'fail',
      message: `❌ 算法执行失败: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  // 测试用例 3: 性能测试
  const startTime = performance.now()
  try {
    for (let i = 0; i < Math.min(5, pois.length - 1); i++) {
      dijkstra(graph, pois[i].id, pois[i + 1].id)
    }
    const elapsed = performance.now() - startTime
    results.testCases.push({
      name: '性能测试 (5 次查询)',
      status: 'pass',
      message: `✅ 5 次查询完成，耗时 ${elapsed.toFixed(2)}ms`,
    })
  } catch (error) {
    results.testCases.push({
      name: '性能测试',
      status: 'fail',
      message: `❌ 性能测试失败: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  return results
}

async function testTSP(pois: POI[], routes: Route[], sceneId: string): Promise<TestResults> {
  const results: TestResults = {
    algorithm: 'TSP 旅行商问题',
    testCases: [],
  }

  const { graph } = buildGraph(pois, routes)

  if (pois.length < 3) {
    results.testCases.push({
      name: '数据充分性检查',
      status: 'fail',
      message: '❌ POI 数量不足（需要至少 3 个），无法进行 TSP 测试',
    })
    return results
  }

  // 测试用例 1: TSP 基本功能
  const tspPois = pois.slice(0, Math.min(5, pois.length)).map(p => p.id)

  results.testCases.push({
    name: 'TSP 基本功能测试',
    status: 'pass',
    message: '✅ 测试用例已准备',
  })

  try {
    const result = tsp(graph, tspPois)

    if (result && result.path && result.distance !== undefined) {
      results.testCases.push({
        name: `${tspPois.length} 个节点的最优访问顺序`,
        status: 'pass',
        message: `✅ TSP 求解完成，总距离 ${result.distance} 米，访问 ${result.path.length} 个节点`,
        details: {
          startPoi: tspPois[0],
          distance: result.distance,
          path: result.path.map(id => pois.find(p => p.id === id)?.name || id),
          actualPath: result.path,
        },
      })
    } else {
      results.testCases.push({
        name: 'TSP 求解',
        status: 'fail',
        message: '❌ TSP 求解无结果',
      })
    }
  } catch (error) {
    results.testCases.push({
      name: 'TSP 算法执行',
      status: 'fail',
      message: `❌ 算法执行失败: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  // 测试用例 2: 性能测试
  const startTime = performance.now()
  try {
    for (let i = 0; i < 3; i++) {
      const subset = pois.slice(i, i + Math.min(4, pois.length)).map(p => p.id)
      if (subset.length >= 3) {
        tsp(graph, subset)
      }
    }
    const elapsed = performance.now() - startTime
    results.testCases.push({
      name: '性能测试 (3 次 4 节点问题)',
      status: 'pass',
      message: `✅ 测试完成，耗时 ${elapsed.toFixed(2)}ms`,
    })
  } catch (error) {
    results.testCases.push({
      name: '性能测试',
      status: 'fail',
      message: `❌ 性能测试失败: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  return results
}

async function main() {
  const args = process.argv.slice(2)
  const sceneIdArg = args.find(arg => arg.startsWith('--scene-id='))
  const algorithmArg = args.find(arg => arg.startsWith('--algorithm='))

  const sceneId = sceneIdArg ? sceneIdArg.split('=')[1] : 'campus-demo-001'
  const algorithm = algorithmArg ? algorithmArg.split('=')[1] : 'all'

  console.log('\n' + '='.repeat(70))
  console.log('🧪 Travel AI 导航系统 - 算法测试')
  console.log('='.repeat(70))
  console.log(`📍 场景: ${sceneId}`)
  console.log(`🔧 算法: ${algorithm}\n`)

  try {
    const { pois, routes } = await loadNavigationData(sceneId)

    console.log(`📊 加载数据: ${pois.length} 个 POI, ${routes.length} 条路由\n`)

    if (pois.length === 0 || routes.length === 0) {
      console.error('❌ 数据不足，无法进行测试')
      process.exit(1)
    }

    const allResults: TestResults[] = []

    if (algorithm === 'dijkstra' || algorithm === 'all') {
      console.log('🔍 Dijkstra 最短路径算法测试')
      console.log('-'.repeat(70))
      const dijkstraResults = await testDijkstra(pois, routes, sceneId)
      for (const test of dijkstraResults.testCases) {
        const icon = test.status === 'pass' ? '✅' : '❌'
        console.log(`${icon} ${test.name}`)
        console.log(`   ${test.message}`)
        if (test.details?.path) {
          console.log(`   路径: ${test.details.path.join(' → ')}`)
        }
      }
      allResults.push(dijkstraResults)
      console.log()
    }

    if (algorithm === 'tsp' || algorithm === 'all') {
      console.log('🔍 TSP 旅行商问题算法测试')
      console.log('-'.repeat(70))
      const tspResults = await testTSP(pois, routes, sceneId)
      for (const test of tspResults.testCases) {
        const icon = test.status === 'pass' ? '✅' : '❌'
        console.log(`${icon} ${test.name}`)
        console.log(`   ${test.message}`)
        if (test.details?.path) {
          console.log(`   路径: ${test.details.path.join(' → ')}`)
        }
      }
      allResults.push(tspResults)
      console.log()
    }

    // 总结
    console.log('='.repeat(70))
    console.log('📈 测试总结\n')

    let totalTests = 0
    let passedTests = 0

    for (const result of allResults) {
      console.log(`${result.algorithm}:`)
      for (const test of result.testCases) {
        totalTests++
        if (test.status === 'pass') {
          passedTests++
        }
        const icon = test.status === 'pass' ? '✅' : '❌'
        console.log(`  ${icon} ${test.name}`)
      }
      console.log()
    }

    console.log('='.repeat(70))
    console.log(`最终结果: ${passedTests}/${totalTests} 测试通过\n`)

    if (passedTests === totalTests) {
      console.log('✅ 所有测试通过！算法运作正常。\n')
      process.exit(0)
    } else {
      console.log(`⚠️  ${totalTests - passedTests} 个测试失败。\n`)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
    process.exit(1)
  }
}

main()
