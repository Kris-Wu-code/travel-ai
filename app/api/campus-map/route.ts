import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

type Geometry = {
  type?: string
  coordinates?: any
}

type RawBuilding = {
  osm_id?: string | number | null
  name?: string | null
  kind?: string | null
  centroid?: { type?: string; coordinates?: number[] } | null
  geom?: Geometry | null
}

type RawFacility = {
  osm_id?: string | number | null
  name?: string | null
  category?: string | null
  geom?: Geometry | null
}

type RawRoad = {
  osm_id?: string | number | null
  highway_type?: string | null
  geom?: Geometry | null
}

function asNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function pickPoint(geom: Geometry | null | undefined): [number, number] | null {
  if (!geom || !geom.type || !Array.isArray(geom.coordinates)) return null
  const c = geom.coordinates

  if (geom.type === 'Point' && Array.isArray(c) && c.length >= 2) {
    const lng = asNumber(c[0])
    const lat = asNumber(c[1])
    return lng === null || lat === null ? null : [lng, lat]
  }

  if (geom.type === 'LineString' && Array.isArray(c) && c[0]) {
    const lng = asNumber(c[0][0])
    const lat = asNumber(c[0][1])
    return lng === null || lat === null ? null : [lng, lat]
  }

  if (geom.type === 'Polygon' && Array.isArray(c) && c[0] && c[0][0]) {
    const lng = asNumber(c[0][0][0])
    const lat = asNumber(c[0][0][1])
    return lng === null || lat === null ? null : [lng, lat]
  }

  if (geom.type === 'MultiPolygon' && Array.isArray(c) && c[0] && c[0][0] && c[0][0][0]) {
    const lng = asNumber(c[0][0][0][0])
    const lat = asNumber(c[0][0][0][1])
    return lng === null || lat === null ? null : [lng, lat]
  }

  return null
}

function extractRoadLines(geom: Geometry | null | undefined): number[][][] {
  if (!geom || !geom.type || !Array.isArray(geom.coordinates)) return []

  if (geom.type === 'LineString') {
    const points = geom.coordinates
      .map((pair: unknown[]) => [asNumber(pair[0]), asNumber(pair[1])])
      .filter((pair: (number | null)[]) => pair[0] !== null && pair[1] !== null) as number[][]

    return points.length >= 2 ? [points] : []
  }

  if (geom.type === 'MultiLineString') {
    return geom.coordinates
      .map((line: unknown[][]) => line
        .map((pair: unknown[]) => [asNumber(pair[0]), asNumber(pair[1])])
        .filter((pair: (number | null)[]) => pair[0] !== null && pair[1] !== null) as number[][])
      .filter((line: number[][]) => line.length >= 2)
  }

  return []
}

function datasetPath(dataset: string): string {
  const safeDataset = dataset === 'forbidden_city' || dataset === 'badaling' ? dataset : 'bupt_shahe'
  return path.join(process.cwd(), 'scripts', 'data', `${safeDataset}.normalized.json`)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dataset = (searchParams.get('dataset') || 'bupt_shahe').trim()
  const filePath = datasetPath(dataset)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: `Dataset not found: ${dataset}` }, { status: 404 })
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
    buildings?: RawBuilding[]
    facilities?: RawFacility[]
    roads?: RawRoad[]
  }

  const buildings = (raw.buildings || [])
    .map((item, index) => {
      const p = item.centroid?.type === 'Point' && Array.isArray(item.centroid.coordinates)
        ? [asNumber(item.centroid.coordinates[0]), asNumber(item.centroid.coordinates[1])]
        : pickPoint(item.geom)

      if (!p || p[0] === null || p[1] === null) return null

      return {
        id: String(item.osm_id || `building-${index + 1}`),
        name: item.name || `建筑 ${index + 1}`,
        kind: item.kind || '未分类建筑',
        lng: p[0],
        lat: p[1],
      }
    })
    .filter((item): item is { id: string; name: string; kind: string; lng: number; lat: number } => item !== null)

  const facilities = (raw.facilities || [])
    .map((item, index) => {
      const p = pickPoint(item.geom)
      if (!p) return null

      return {
        id: String(item.osm_id || `facility-${index + 1}`),
        name: item.name || `设施 ${index + 1}`,
        category: item.category || '未分类设施',
        lng: p[0],
        lat: p[1],
      }
    })
    .filter((item): item is { id: string; name: string; category: string; lng: number; lat: number } => item !== null)

  const roads = (raw.roads || [])
    .flatMap((item, index) => {
      const lines = extractRoadLines(item.geom)
      return lines.map((line, lineIdx) => ({
        id: String(item.osm_id || `road-${index + 1}-${lineIdx + 1}`),
        highwayType: item.highway_type || '未分类道路',
        points: line,
      }))
    })

  const allPoints = [
    ...buildings.map(item => ({ lng: item.lng, lat: item.lat })),
    ...facilities.map(item => ({ lng: item.lng, lat: item.lat })),
    ...roads.flatMap(item => item.points.map(([lng, lat]) => ({ lng, lat }))),
  ]

  const lngList = allPoints.map(item => item.lng)
  const latList = allPoints.map(item => item.lat)

  const bbox = allPoints.length
    ? {
        minLng: Math.min(...lngList),
        maxLng: Math.max(...lngList),
        minLat: Math.min(...latList),
        maxLat: Math.max(...latList),
      }
    : null

  return NextResponse.json({
    dataset: dataset === 'forbidden_city' || dataset === 'badaling' ? dataset : 'bupt_shahe',
    stats: {
      buildings: buildings.length,
      facilities: facilities.length,
      roads: roads.length,
      facilityKinds: new Set(facilities.map(item => item.category)).size,
    },
    bbox,
    buildings,
    facilities,
    roads,
  })
}
