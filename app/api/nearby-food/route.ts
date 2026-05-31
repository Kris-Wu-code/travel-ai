import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

export const dynamic = 'force-dynamic'

function getAmapKey() {
  return (process.env.AMAP_SERVICE_KEY || process.env.AMAP_API_KEY || '').trim()
}

type NearbyFood = {
  id: string
  name: string
  type: string
  typeCode: string
  city: string
  district: string
  address: string
  latitude: number
  longitude: number
  distance: number
  rating: string | null
  cost: string | null
  tel: string | null
  provider: 'amap'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lng = Number(searchParams.get('lng') || '')
  const lat = Number(searchParams.get('lat') || '')
  const radius = Number(searchParams.get('radius') || '3000')
  const keyword = searchParams.get('keyword')?.trim() || ''

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return NextResponse.json({ error: 'Missing valid lng/lat' }, { status: 400 })
  }

  const amapKey = getAmapKey()
  if (!amapKey) {
    return NextResponse.json({ error: 'Missing AMap service key' }, { status: 500 })
  }

  const PAGE_SIZE = 25
  const MAX_PAGES = 40 // AMap practical limit: 25 × 40 = 1000

  function mapPoi(poi: any): NearbyFood {
    return {
      id: poi.id || `${poi.name}-${poi.location}`,
      name: (poi.name || '未知').slice(0, 120),
      type: (poi.type || '').slice(0, 120),
      typeCode: (poi.typecode || '').slice(0, 32),
      city: (poi.cityname || poi.pname || '').slice(0, 64),
      district: (poi.adname || '').slice(0, 64),
      address: (poi.address || '').slice(0, 200),
      latitude: Number(poi.location?.split(',')[1]) || 0,
      longitude: Number(poi.location?.split(',')[0]) || 0,
      distance: Number(poi.distance) || 0,
      rating: poi.biz_ext?.rating || null,
      cost: poi.biz_ext?.cost || null,
      tel: poi.tel?.[0] || poi.tel || null,
      provider: 'amap' as const,
    }
  }

  const sharedParams = {
    key: amapKey,
    location: `${lng},${lat}`,
    keywords: keyword || '美食|餐厅|小吃|咖啡|奶茶|火锅|日料|西餐',
    types: '050000|050100|050200|050300|050500|050800',
    radius: Math.min(Math.max(radius, 500), 50000),
    offset: PAGE_SIZE,
    extensions: 'all',
    output: 'json',
  }

  try {
    // Fetch first page to get total count
    const firstPage = await axios.get('https://restapi.amap.com/v3/place/around', {
      params: { ...sharedParams, page: 1 },
      timeout: 10000,
    })

    const total = Number(firstPage.data?.count || 0)
    const totalPages = Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES)

    // Fetch remaining pages in parallel
    const remainingPages = totalPages > 1
      ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            axios.get('https://restapi.amap.com/v3/place/around', {
              params: { ...sharedParams, page: i + 2 },
              timeout: 10000,
            }).catch(() => null),
          ),
        )
      : []

    const allPages = [firstPage, ...remainingPages]

    const seen = new Set<string>()
    const foods: NearbyFood[] = []

    for (const response of allPages) {
      if (!response) continue
      const rawPois = Array.isArray(response.data?.pois) ? response.data.pois : []
      for (const poi of rawPois) {
        const food = mapPoi(poi)
        if (!seen.has(food.id)) {
          seen.add(food.id)
          foods.push(food)
        }
      }
    }

    return NextResponse.json({
      foods,
      total,
      center: { lng, lat },
      radius,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nearby food search failed'
    return NextResponse.json({ error: '附近美食搜索失败', message }, { status: 500 })
  }
}
