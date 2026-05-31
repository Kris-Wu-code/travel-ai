/**
 * 导航 API 路由
 * 提供最短路径、TSP 和路由查询功能
 *
 * 使用方法：
 *   GET /api/navigation/shortest-path?sceneId=xxx&startId=xxx&endId=xxx
 *   GET /api/navigation/tsp?sceneId=xxx&poiIds=xxx,xxx,xxx
 *   GET /api/navigation/graph?sceneId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dijkstra } from '../../lib/algo/dijkstra'
import { tsp } from '../../lib/algo/tsp'
import { Graph } from '../../lib/algo/graph'

interface POI {
  id: string
  name: string
  poi_type: string
  floor: number | null
  latitude: number
  longitude: number
}

interface Route {
  start_poi_id: string
  end_poi_id: string
  distance_meters: number
  ideal_time_seconds: number
  is_available: boolean
}

interface Floor {
  floor: number
  floor_name: string | null
  map_width_px: number | null
  map_height_px: number | null
  scale_meters_per_px: number | null
}

function edgeKey(fromId: string, toId: string) {
  return `${fromId}->${toId}`
}

function buildRouteTimeLookup(routes: Route[]) {
  const timeLookup = new Map<string, number>()

  for (const route of routes) {
    if (!route.is_available) {
      continue
    }

    const normalizedTime = Math.max(1, Math.round(route.ideal_time_seconds || 0))
    const directKey = edgeKey(route.start_poi_id, route.end_poi_id)
    const reverseKey = edgeKey(route.end_poi_id, route.start_poi_id)

    const previousDirect = timeLookup.get(directKey)
    const previousReverse = timeLookup.get(reverseKey)
    timeLookup.set(directKey, previousDirect ? Math.min(previousDirect, normalizedTime) : normalizedTime)
    timeLookup.set(reverseKey, previousReverse ? Math.min(previousReverse, normalizedTime) : normalizedTime)
  }

  return timeLookup
}

function estimatePathTimeSeconds(path: string[], timeLookup: Map<string, number>, fallbackSpeedMps = 1.5) {
  if (path.length < 2) {
    return 0
  }

  let total = 0

  for (let i = 0; i < path.length - 1; i += 1) {
    const key = edgeKey(path[i], path[i + 1])
    const segmentTime = timeLookup.get(key)

    if (segmentTime) {
      total += segmentTime
      continue
    }

    // Fallback when a segment is not present in route metadata.
    total += Math.round(30 / fallbackSpeedMps)
  }

  return total
}

// 构建图表
function buildGraph(pois: POI[], routes: Route[]): { graph: Graph<string>; poiMap: Map<string, POI> } {
  const graph = new Graph<string>()
  const poiMap = new Map<string, POI>()

  // 添加顶点
  for (const poi of pois) {
    graph.addVertex(poi.id, poi.name)
    poiMap.set(poi.id, poi)
  }

  // 添加边
  for (const route of routes) {
    if (route.is_available) {
      graph.addEdge(route.start_poi_id, route.end_poi_id, route.distance_meters)
      // 假设路由是双向的
      graph.addEdge(route.end_poi_id, route.start_poi_id, route.distance_meters)
    }
  }

  return { graph, poiMap }
}

// 最短路径 API
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'shortest-path'
  const sceneId = searchParams.get('sceneId')

  if (!sceneId) {
    return NextResponse.json({ error: 'Missing sceneId parameter' }, { status: 400 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // 加载 POI 和路由数据
    const [poisResult, routesResult, floorsResult] = await Promise.all([
      supabase.from('scene_pois').select('*').eq('scene_id', sceneId).eq('is_active', true),
      supabase.from('scene_routes').select('*').eq('scene_id', sceneId),
      supabase.from('scene_floors').select('*').eq('scene_id', sceneId).order('floor', { ascending: true }),
    ])

    const pois = (poisResult.data || []) as POI[]
    const routes = (routesResult.data || []) as Route[]
    const floors = (floorsResult.data || []) as Floor[]


    if (pois.length === 0) {
      return NextResponse.json({ error: `No POIs found for scene ${sceneId}` }, { status: 404 })
    }

    const { graph, poiMap } = buildGraph(pois, routes)
    const routeTimeLookup = buildRouteTimeLookup(routes)

    // 最短路径
    if (action === 'shortest-path') {
      const startId = searchParams.get('startId')
      const endId = searchParams.get('endId')

      if (!startId || !endId) {
        return NextResponse.json(
          { error: 'Missing startId or endId parameters' },
          { status: 400 },
        )
      }

      if (!poiMap.has(startId) || !poiMap.has(endId)) {
        return NextResponse.json({ error: 'Invalid POI ID' }, { status: 400 })
      }

      if (startId === endId) {
        return NextResponse.json(
          { error: '起点和终点不能相同，请重新选择' },
          { status: 400 },
        )
      }

      const result = dijkstra(graph, startId, endId)

      if (result.distance === Infinity) {
        return NextResponse.json(
          { error: 'No path found between the two POIs' },
          { status: 404 },
        )
      }

      const pathDetails = result.path!.map((id: string) => {
        const poi = poiMap.get(id)!
        return {
          id,
          name: poi.name,
          type: poi.poi_type,
          floor: poi.floor,
          location: { lat: poi.latitude, lng: poi.longitude },
        }
      })

      return NextResponse.json({
        sceneId,
        startPoi: poiMap.get(startId),
        endPoi: poiMap.get(endId),
        distance: result.distance,
        estimatedTime: estimatePathTimeSeconds(result.path || [], routeTimeLookup),
        path: result.path,
        pathDetails,
      })
    }

    // TSP
    if (action === 'tsp') {
      const poiIdsStr = searchParams.get('poiIds')

      if (!poiIdsStr) {
        return NextResponse.json({ error: 'Missing poiIds parameter' }, { status: 400 })
      }

      const poiIds = poiIdsStr.split(',')

      if (poiIds.length < 3) {
        return NextResponse.json({
          error: 'At least 3 POIs are required for TSP',
          status: 400,
        })
      }

      if (!poiIds.every(id => poiMap.has(id))) {
        return NextResponse.json({ error: 'Invalid POI IDs' }, { status: 400 })
      }

      const result = tsp(graph, poiIds)

      if (!result) {
        return NextResponse.json({ error: 'TSP solving failed' }, { status: 500 })
      }

      const pathDetails = result.path.map((id: string) => {
        const poi = poiMap.get(id)!
        return {
          id,
          name: poi.name,
          type: poi.poi_type,
          floor: poi.floor,
          location: { lat: poi.latitude, lng: poi.longitude },
        }
      })

      return NextResponse.json({
        sceneId,
        totalDistance: result.distance,
        estimatedTime: estimatePathTimeSeconds(result.path, routeTimeLookup),
        path: result.path,
        pathDetails,
        optimizationAlgorithm: 'dynamic-programming-with-heuristics',
      })
    }

    // 图表信息
    if (action === 'graph-info') {
      return NextResponse.json({
        sceneId,
        stats: {
          totalPois: pois.length,
          totalRoutes: routes.length,
          poiTypes: [...new Set(pois.map(p => p.poi_type))],
          floors: [...new Set(pois.map(p => p.floor).filter(f => f !== null))],
        },
        pois: pois.map(p => ({
          id: p.id,
          name: p.name,
          type: p.poi_type,
          floor: p.floor,
          location: { lat: p.latitude, lng: p.longitude },
        })),
        routes: routes
          .filter(r => r.is_available)
          .map(r => ({
            fromId: r.start_poi_id,
            toId: r.end_poi_id,
            from: pois.find(p => p.id === r.start_poi_id)?.name,
            to: pois.find(p => p.id === r.end_poi_id)?.name,
            distance: r.distance_meters,
            time: r.ideal_time_seconds,
            floor: pois.find(p => p.id === r.start_poi_id)?.floor ?? null,
          })),
        floors: floors.map(floor => ({
          floor: floor.floor,
          name: floor.floor_name,
          width: floor.map_width_px,
          height: floor.map_height_px,
          scale: floor.scale_meters_per_px,
        })),
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Navigation API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
