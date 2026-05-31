import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

type RawPoi = {
  id?: string
  name?: string
  type?: string
  typecode?: string
  cityname?: string
  adname?: string
  address?: string
  location?: string
  pname?: string
  tel?: string
}

type NormalizedPoi = {
  id: string
  name: string
  type: string
  typeCode: string
  city: string
  district: string
  address: string
  latitude: number | null
  longitude: number | null
  provider: 'amap'
}

export const dynamic = 'force-dynamic'

function getAmapServiceKey() {
  return (process.env.AMAP_SERVICE_KEY || process.env.AMAP_API_KEY || '').trim()
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizePoi(poi: RawPoi): NormalizedPoi | null {
  const [lngText, latText] = (poi.location || '').split(',')
  const longitude = parseNumber(lngText)
  const latitude = parseNumber(latText)

  if (longitude === null || latitude === null) {
    return null
  }

  return {
    id: poi.id || `${poi.name || 'poi'}-${lngText}-${latText}`,
    name: (poi.name || '未知地点').slice(0, 120),
    type: (poi.type || '').slice(0, 120),
    typeCode: (poi.typecode || '').slice(0, 32),
    city: (poi.cityname || poi.pname || '').slice(0, 64),
    district: (poi.adname || '').slice(0, 64),
    address: (poi.address || '').slice(0, 200),
    latitude,
    longitude,
    provider: 'amap',
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('q')?.trim() || ''
  const city = searchParams.get('city')?.trim() || ''
  const types = searchParams.get('types')?.trim() || ''
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const offset = Math.min(25, Math.max(1, Number(searchParams.get('offset') || '10')))

  if (!keyword) {
    return NextResponse.json({ pois: [], total: 0, page, offset })
  }

  const amapKey = getAmapServiceKey()
  if (!amapKey) {
    return NextResponse.json(
      { error: 'Missing AMAP_SERVICE_KEY or AMAP_API_KEY' },
      { status: 500 },
    )
  }

  try {
    const response = await axios.get('https://restapi.amap.com/v3/place/text', {
      params: {
        key: amapKey,
        keywords: keyword,
        city,
        types,
        page,
        offset,
        extensions: 'base',
        output: 'json',
      },
      timeout: 10000,
    })

    const rawPois = Array.isArray(response.data?.pois) ? (response.data.pois as RawPoi[]) : []
    const pois = rawPois
      .map(normalizePoi)
      .filter((poi): poi is NormalizedPoi => poi !== null)

    return NextResponse.json({
      pois,
      total: Number(response.data?.count || pois.length),
      page,
      offset,
      query: {
        keyword,
        city,
        types,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'POI search failed'
    console.error('[real-world-poi-search] error:', message)
    return NextResponse.json(
      { error: '高德 POI 搜索失败', message },
      { status: 500 },
    )
  }
}