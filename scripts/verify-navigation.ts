/**
 * 导航系统验证脚本
 * 检查导航数据的完整性和正确性
 *
 * 使用方法：
 *   npx tsx scripts/verify-navigation.ts --scene-id "YOUR_SCENE_ID"
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface ValidationReport {
  totalErrors: number
  totalWarnings: number
  checks: {
    name: string
    status: 'pass' | 'warn' | 'fail'
    message: string
    details?: string[]
  }[]
}

async function verifyNavigationData(sceneId: string): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseKey)
  const report: ValidationReport = {
    totalErrors: 0,
    totalWarnings: 0,
    checks: [],
  }

  console.log('\n' + '='.repeat(70))
  console.log('🔍 Travel AI 导航系统 - 数据验证')
  console.log('='.repeat(70))
  console.log(`📍 检查场景: ${sceneId}\n`)

  try {
    // 检查 1: 场景是否存在
    console.log('✓ 检查 1: 场景存在性')
    const { data: sceneData, error: sceneError } = await supabase
      .from('scenes')
      .select('id, name, available_transports')
      .eq('id', sceneId)
      .single()

    if (sceneError || !sceneData) {
      report.checks.push({
        name: '场景存在',
        status: 'fail',
        message: `场景 ${sceneId} 不存在`,
      })
      report.totalErrors++
      console.log(`  ❌ 场景不存在: ${sceneId}\n`)
      return false
    }

    report.checks.push({
      name: '场景存在',
      status: 'pass',
      message: `✅ 场景 "${sceneData.name}" 存在`,
    })
    console.log(`  ✅ 场景存在: ${sceneData.name}\n`)

    // 检查 2: POI 数据
    console.log('✓ 检查 2: POI 数据')
    const { data: pois, error: poisError } = await supabase
      .from('scene_pois')
      .select('*')
      .eq('scene_id', sceneId)
      .order('floor', { ascending: true })

    if (poisError || !pois || pois.length === 0) {
      report.checks.push({
        name: 'POI 数据',
        status: 'warn',
        message: '没有找到 POI 数据',
      })
      report.totalWarnings++
      console.log(`  ⚠️  没有找到 POI 数据\n`)
    } else {
      const details: string[] = []
      const floorGroups = new Map<string, number>()

      for (const poi of pois) {
        const floor = poi.floor === null ? 'outdoor' : String(poi.floor)
        floorGroups.set(floor, (floorGroups.get(floor) ?? 0) + 1)

        if (!poi.is_active) {
          details.push(`  ⚠️  POI "${poi.name}" 已禁用 (is_active=false)`)
        }

        if (!poi.latitude || !poi.longitude) {
          details.push(`  ⚠️  POI "${poi.name}" 缺少坐标信息`)
        }
      }

      report.checks.push({
        name: 'POI 数据',
        status: 'pass',
        message: `✅ 共 ${pois.length} 个 POI`,
        details: [
          ...Array.from(floorGroups.entries()).map(
            ([floor, count]) => `   - 楼层 ${floor === 'outdoor' ? '室外' : floor}: ${count} 个`,
          ),
          ...details,
        ],
      })

      console.log(`  ✅ POI 数据: ${pois.length} 个`)
      for (const [floor, count] of Array.from(floorGroups.entries())) {
        console.log(`     - 楼层 ${floor === 'outdoor' ? '室外' : floor}: ${count} 个`)
      }
      console.log()
    }

    // 检查 3: 路线数据
    console.log('✓ 检查 3: 路线数据')
    const { data: routes, error: routesError } = await supabase
      .from('scene_routes')
      .select('*')
      .eq('scene_id', sceneId)

    if (routesError || !routes || routes.length === 0) {
      report.checks.push({
        name: '路线数据',
        status: 'warn',
        message: '没有找到路线数据',
      })
      report.totalWarnings++
      console.log(`  ⚠️  没有找到路线数据\n`)
    } else {
      const details: string[] = []
      const transportTypes = new Map<string, number>()
      let unavailableCount = 0

      for (const route of routes) {
        transportTypes.set(route.transport_type, (transportTypes.get(route.transport_type) ?? 0) + 1)

        if (!route.is_available) {
          unavailableCount++
        }

        if (route.congestion_factor < 0.5 || route.congestion_factor > 5) {
          details.push(`  ⚠️  路线拥堵系数异常: ${route.congestion_factor}`)
        }

        if (route.distance_meters <= 0) {
          details.push(`  ❌ 路线距离无效: ${route.distance_meters}`)
        }

        if (route.ideal_time_seconds <= 0) {
          details.push(`  ❌ 路线时间无效: ${route.ideal_time_seconds}`)
        }
      }

      if (unavailableCount > 0) {
        details.push(`  ⚠️  ${unavailableCount} 条路线已禁用 (is_available=false)`)
      }

      report.checks.push({
        name: '路线数据',
        status: details.some(d => d.startsWith('❌')) ? 'fail' : 'pass',
        message: `✅ 共 ${routes.length} 条路线`,
        details: [
          ...Array.from(transportTypes.entries()).map(
            ([type, count]) => `   - ${type}: ${count} 条`,
          ),
          ...details,
        ],
      })

      console.log(`  ✅ 路线数据: ${routes.length} 条`)
      for (const [type, count] of Array.from(transportTypes.entries())) {
        console.log(`     - ${type}: ${count} 条`)
      }
      console.log()
    }

    // 检查 4: 路线完整性
    console.log('✓ 检查 4: 路线完整性')
    const details4: string[] = []
    let brokenRoutes = 0

    if (pois && routes) {
      const poiIds = new Set(pois.map(p => p.id))

      for (const route of routes) {
        if (!poiIds.has(route.start_poi_id)) {
          details4.push(`  ❌ 路线引用的起点不存在`)
          brokenRoutes++
        }
        if (!poiIds.has(route.end_poi_id)) {
          details4.push(`  ❌ 路线引用的终点不存在`)
          brokenRoutes++
        }
      }
    }

    if (brokenRoutes > 0) {
      report.checks.push({
        name: '路线完整性',
        status: 'fail',
        message: `❌ 发现 ${brokenRoutes} 个引用错误`,
        details: details4,
      })
      report.totalErrors++
    } else {
      report.checks.push({
        name: '路线完整性',
        status: 'pass',
        message: '✅ 所有路线引用有效',
      })
    }
    console.log(`  ✅ 路线引用完整\n`)

    // 检查 5: 楼层数据
    console.log('✓ 检查 5: 楼层数据')
    const { data: floors, error: floorsError } = await supabase
      .from('scene_floors')
      .select('*')
      .eq('scene_id', sceneId)
      .order('floor', { ascending: true })

    if (!floorsError && floors && floors.length > 0) {
      report.checks.push({
        name: '楼层数据',
        status: 'pass',
        message: `✅ 共 ${floors.length} 个楼层`,
        details: floors.map(f => `   - 楼层 ${f.floor}: ${f.floor_name}`),
      })
      console.log(`  ✅ 楼层数据: ${floors.length} 个`)
      for (const floor of floors) {
        console.log(`     - 楼层 ${floor.floor}: ${floor.floor_name}`)
      }
    } else {
      report.checks.push({
        name: '楼层数据',
        status: 'warn',
        message: '⚠️  没有楼层数据（仅适用于景区场景）',
      })
      report.totalWarnings++
      console.log(`  ⚠️  没有楼层数据\n`)
    }

    // 检查 6: 图表连接性（简易）
    console.log('✓ 检查 6: 图表连接性')
    if (pois && routes && routes.length > 0) {
      const poiNeighbors = new Map<string, number>()
      for (const route of routes) {
        const key = `${route.start_poi_id}|${route.end_poi_id}`
        poiNeighbors.set(key, (poiNeighbors.get(key) ?? 0) + 1)
      }

      const isolatedPois = pois.filter(
        p => !routes.some(r => r.start_poi_id === p.id || r.end_poi_id === p.id),
      )

      if (isolatedPois.length > 0) {
        report.checks.push({
          name: '图表连接性',
          status: 'warn',
          message: `⚠️  有 ${isolatedPois.length} 个孤立节点`,
          details: isolatedPois.map(p => `   - ${p.name}`),
        })
        report.totalWarnings++
        console.log(`  ⚠️  有 ${isolatedPois.length} 个孤立 POI`)
      } else {
        report.checks.push({
          name: '图表连接性',
          status: 'pass',
          message: '✅ 所有 POI 均连接',
        })
        console.log(`  ✅ 所有 POI 均连接\n`)
      }
    }

    // 打印总结
    console.log('='.repeat(70))
    console.log('📊 验证总结\n')

    for (const check of report.checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️ ' : '❌'
      console.log(`${icon} ${check.name}: ${check.message}`)
      if (check.details) {
        for (const detail of check.details) {
          console.log(detail)
        }
      }
    }

    console.log('\n' + '='.repeat(70))
    if (report.totalErrors === 0 && report.totalWarnings === 0) {
      console.log('✅ 验证完全通过！数据质量优秀。\n')
      return true
    } else if (report.totalErrors === 0) {
      console.log(`⚠️  验证完成，但有 ${report.totalWarnings} 个警告。\n`)
      return true
    } else {
      console.log(`❌ 验证失败，发现 ${report.totalErrors} 个错误，${report.totalWarnings} 个警告。\n`)
      return false
    }
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error)
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  const sceneIdArg = args.find(arg => arg.startsWith('--scene-id='))
  const sceneId = sceneIdArg ? sceneIdArg.split('=')[1] : 'campus-demo-001'

  const success = await verifyNavigationData(sceneId)
  process.exit(success ? 0 : 1)
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
