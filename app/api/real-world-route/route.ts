import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

type RouteMode = 'walking' | 'driving'

type Step = {
  instruction: string
  road: string
  distance: number
  duration: number
  polyline: Array<{ lng: number; lat: number }>
}

type RoutePlanResponse = {
  id: string
  label: string
  reason: string
  strategy: number
  mode: RouteMode
  origin: { lng: number; lat: number }
  destination: { lng: number; lat: number }
  summary: {
    distance: number
    duration: number
    trafficLights?: number
    taxiCost?: number
  }
  steps: Step[]
  polyline: Array<{ lng: number; lat: number }>
  provider: 'amap'
}

type RouteCollectionResponse = RoutePlanResponse & {
  routes: RoutePlanResponse[]
  activeRouteId: string
}

export const dynamic = 'force-dynamic'

function getAmapServiceKey() {
  return (process.env.AMAP_SERVICE_KEY || process.env.AMAP_API_KEY || '').trim()
}

function parsePoint(text: string | undefined | null) {
  if (!text) return null
  const [lngText, latText] = text.split(',')
  const lng = Number(lngText)
  const lat = Number(latText)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null
  }
  return { lng, lat }
}

function parsePolyline(polylineText: string | undefined) {
  if (!polylineText) return []
  return polylineText
    .split(';')
    .map(pair => {
      const [lngText, latText] = pair.split(',')
      const lng = Number(lngText)
      const lat = Number(latText)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return null
      }
      return { lng, lat }
    })
    .filter((point): point is { lng: number; lat: number } => point !== null)
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeWalking(data: any, origin: { lng: number; lat: number }, destination: { lng: number; lat: number }): RoutePlanResponse | null {
  const path = data?.route?.paths?.[0]
  if (!path) {
    return null
  }

  const steps: Step[] = (path.steps || []).map((step: any) => ({
    instruction: String(step.instruction || '请沿道路前行'),
    road: String(step.road || ''),
    distance: asNumber(step.distance),
    duration: asNumber(step.duration),
    polyline: parsePolyline(step.polyline),
  }))

  const polyline = steps.flatMap(step => step.polyline)

  return {
    id: 'walking-default',
    label: '步行路线',
    reason: '当前为步行模式，暂时只返回一条主路线。',
    strategy: 0,
    mode: 'walking',
    origin,
    destination,
    summary: {
      distance: asNumber(path.distance),
      duration: asNumber(path.duration),
    },
    steps,
    polyline,
    provider: 'amap',
  }
}

function normalizeDriving(data: any, origin: { lng: number; lat: number }, destination: { lng: number; lat: number }): RoutePlanResponse | null {
  const path = data?.route?.paths?.[0]
  if (!path) {
    return null
  }

  const steps: Step[] = (path.steps || []).map((step: any) => ({
    instruction: String(step.instruction || '请沿道路前行'),
    road: String(step.road || ''),
    distance: asNumber(step.distance),
    duration: asNumber(step.duration),
    polyline: parsePolyline(step.polyline),
  }))

  const polyline = steps.flatMap(step => step.polyline)

  return {
    id: 'driving-default',
    label: '驾车路线',
    reason: '当前为驾车模式，结果为默认候选。',
    strategy: 0,
    mode: 'driving',
    origin,
    destination,
    summary: {
      distance: asNumber(path.distance),
      duration: asNumber(path.duration),
      trafficLights: asNumber(path.traffic_lights),
      taxiCost: asNumber(path.taxi_cost),
    },
    steps,
    polyline,
    provider: 'amap',
  }
}

function scoreDistance(distance: number, duration: number, trafficLights: number) {
  return distance + duration * 0.5 + trafficLights * 40
}

function buildRouteReason(route: RoutePlanResponse, baseline: RoutePlanResponse) {
  const durationDelta = Math.round(route.summary.duration - baseline.summary.duration)
  const distanceDelta = Math.round(route.summary.distance - baseline.summary.distance)
  const trafficDelta = Math.round((route.summary.trafficLights || 0) - (baseline.summary.trafficLights || 0))

  const durationText = durationDelta === 0
    ? '用时相近'
    : durationDelta > 0
      ? `慢 ${Math.round(durationDelta / 60)} 分钟`
      : `快 ${Math.round(Math.abs(durationDelta) / 60)} 分钟`

  const distanceText = distanceDelta === 0
    ? '距离接近'
    : distanceDelta > 0
      ? `多 ${Math.round(distanceDelta / 100)} 百米`
      : `少 ${Math.round(Math.abs(distanceDelta) / 100)} 百米`

  const trafficText = trafficDelta === 0
    ? '红绿灯差异不大'
    : trafficDelta > 0
      ? `多 ${trafficDelta} 个红绿灯`
      : `少 ${Math.abs(trafficDelta)} 个红绿灯`

  return `相对最快路线：${durationText}，${distanceText}，${trafficText}。`
}

async function fetchDrivingCandidate(
  amapKey: string,
  originText: string,
  destinationText: string,
  origin: { lng: number; lat: number },
  destination: { lng: number; lat: number },
  strategy: number,
  id: string,
  label: string,
) {
  const response = await axios.get('https://restapi.amap.com/v3/direction/driving', {
    params: {
      key: amapKey,
      origin: originText,
      destination: destinationText,
      strategy,
      extensions: 'base',
      output: 'json',
    },
    timeout: 10000,
  })

  const normalized = normalizeDriving(response.data, origin, destination)
  if (!normalized) {
    return null
  }

  return {
    ...normalized,
    id,
    label,
    reason: '',
    strategy,
  }
}

export async function POST(request: NextRequest) {
  const amapKey = getAmapServiceKey()
  if (!amapKey) {
    return NextResponse.json(
      { error: 'Missing AMAP_SERVICE_KEY or AMAP_API_KEY' },
      { status: 500 },
    )
  }

  let body: {
    mode?: RouteMode
    origin?: { lng?: number; lat?: number }
    destination?: { lng?: number; lat?: number }
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const mode: RouteMode = body.mode === 'driving' ? 'driving' : 'walking'
  const origin =
    typeof body.origin?.lng === 'number' && typeof body.origin?.lat === 'number'
      ? { lng: body.origin.lng, lat: body.origin.lat }
      : null
  const destination =
    typeof body.destination?.lng === 'number' && typeof body.destination?.lat === 'number'
      ? { lng: body.destination.lng, lat: body.destination.lat }
      : null

  if (!origin || !destination) {
    return NextResponse.json(
      { error: 'Missing origin or destination coordinates' },
      { status: 400 },
    )
  }

  if (origin.lng === destination.lng && origin.lat === destination.lat) {
    return NextResponse.json(
      { error: 'Origin and destination cannot be the same point' },
      { status: 400 },
    )
  }

  try {
    const originText = `${origin.lng},${origin.lat}`
    const destinationText = `${destination.lng},${destination.lat}`

    if (mode === 'walking') {
      const response = await axios.get('https://restapi.amap.com/v3/direction/walking', {
        params: {
          key: amapKey,
          origin: originText,
          destination: destinationText,
          output: 'json',
        },
        timeout: 10000,
      })

      const normalized = normalizeWalking(response.data, origin, destination)
      if (!normalized) {
        return NextResponse.json(
          { error: 'No walking route found, distance may be too far for walking mode' },
          { status: 404 },
        )
      }

      return NextResponse.json({
        ...normalized,
        routes: [normalized],
        activeRouteId: normalized.id,
      } satisfies RouteCollectionResponse)
    }

    const strategyCandidates = [
      { strategy: 10, id: 'fastest', label: '最快' },
      { strategy: 2, id: 'smooth', label: '更平稳' },
      { strategy: 0, id: 'few-lights', label: '少红灯' },
    ]

    const settled = await Promise.allSettled(
      strategyCandidates.map(candidate =>
        fetchDrivingCandidate(
          amapKey,
          originText,
          destinationText,
          origin,
          destination,
          candidate.strategy,
          candidate.id,
          candidate.label,
        ),
      ),
    )

    const routes = settled
      .flatMap(result => (result.status === 'fulfilled' ? [result.value] : []))
      .filter((route): route is RoutePlanResponse => route !== null)

    if (routes.length === 0) {
      return NextResponse.json(
        { error: 'No driving route found' },
        { status: 404 },
      )
    }

    const baseline = [...routes].sort((a, b) => a.summary.duration - b.summary.duration || a.summary.distance - b.summary.distance)[0]
    const enrichedRoutes = routes
      .map(route => ({
        ...route,
        reason: route.id === baseline.id ? '当前默认选择的最快路线。' : buildRouteReason(route, baseline),
      }))
      .sort((a, b) => {
        if (a.id === 'fastest') return -1
        if (b.id === 'fastest') return 1
        return scoreDistance(a.summary.distance, a.summary.duration, a.summary.trafficLights || 0) - scoreDistance(b.summary.distance, b.summary.duration, b.summary.trafficLights || 0)
      })

    const activeRoute = enrichedRoutes[0]

    return NextResponse.json({
      ...activeRoute,
      routes: enrichedRoutes,
      activeRouteId: activeRoute.id,
    } satisfies RouteCollectionResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Route request failed'
    console.error('[real-world-route] error:', message)
    return NextResponse.json(
      { error: '真实路线规划失败', message },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST /api/real-world-route with JSON body',
    body: {
      mode: 'walking | driving',
      origin: { lng: 120.155, lat: 30.274 },
      destination: { lng: 120.162, lat: 30.251 },
    },
  })
}