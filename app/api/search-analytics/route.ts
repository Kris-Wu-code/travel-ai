import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type HourlyTrend = {
  hour: number
  count: number
}

type CityPreference = {
  city: string
  count: number
}

type KeywordStats = {
  keyword: string
  count: number
  noMatchCount: number
  matchRate: number
}

type SearchAnalyticsResponse = {
  totalSearches: number
  uniqueKeywords: number
  peakHour: { hour: number; count: number }
  hourlyTrends: HourlyTrend[]
  cityPreferences: CityPreference[]
  topKeywords: KeywordStats[]
  searchTodayCount: number
  searchThisWeekCount: number
  averageSearchesPerDay: number
}

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Missing Supabase environment variables' },
      { status: 500 },
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // 获取过去30天的搜索数据
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceIso = since.toISOString()

  const { data: allEvents, error } = await supabase
    .from('search_events')
    .select('keyword, created_at, has_suggestion_match')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })

  if (error || !allEvents) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch data' }, { status: 500 })
  }

  // 基础统计
  const totalSearches = allEvents.length
  const uniqueKeywords = new Set(allEvents.map(e => e.keyword)).size

  // 按小时统计趋势
  const hourlyMap = new Map<number, number>()
  for (let i = 0; i < 24; i++) {
    hourlyMap.set(i, 0)
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekAgoStart = todayStart - 6 * 24 * 60 * 60 * 1000

  let searchTodayCount = 0
  let searchThisWeekCount = 0

  for (const event of allEvents) {
    const eventTime = new Date(event.created_at).getTime()
    if (eventTime >= todayStart) {
      searchTodayCount += 1
    }
    if (eventTime >= weekAgoStart) {
      searchThisWeekCount += 1
    }

    const eventDate = new Date(event.created_at)
    const hour = eventDate.getHours()
    hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1)
  }

  const hourlyTrends: HourlyTrend[] = Array.from(hourlyMap.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour)

  const peakHour = hourlyTrends.reduce((max, curr) => (curr.count > max.count ? curr : max), {
    hour: 0,
    count: 0,
  })

  // 提取城市偏好（从场景名称中猜测，如果包含已知城市名则归类）
  const knownCities = ['杭州', '厦门', '重庆', '上海', '北京', '深圳', '西安', '成都', '南京', '武汉', '天津', '苏州']
  const cityMap = new Map<string, number>()

  for (const event of allEvents) {
    const keyword = event.keyword?.toLowerCase() || ''
    for (const city of knownCities) {
      if (keyword.includes(city)) {
        cityMap.set(city, (cityMap.get(city) ?? 0) + 1)
        break
      }
    }
  }

  const cityPreferences = Array.from(cityMap.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // 关键词统计（带匹配率）
  const keywordMap = new Map<string, { total: number; noMatch: number }>()

  for (const event of allEvents) {
    const kw = event.keyword?.trim() || '__all__'
    if (!kw || kw === '__all__') continue

    const stats = keywordMap.get(kw) || { total: 0, noMatch: 0 }
    stats.total += 1
    if (!event.has_suggestion_match) {
      stats.noMatch += 1
    }
    keywordMap.set(kw, stats)
  }

  const topKeywords: KeywordStats[] = Array.from(keywordMap.entries())
    .map(([keyword, stats]) => ({
      keyword,
      count: stats.total,
      noMatchCount: stats.noMatch,
      matchRate: Number(((1 - stats.noMatch / stats.total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // 计算平均每天搜索次数
  const dayCount = Math.max(1, Math.ceil((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24)))
  const averageSearchesPerDay = Number((totalSearches / dayCount).toFixed(1))

  return NextResponse.json({
    totalSearches,
    uniqueKeywords,
    peakHour,
    hourlyTrends,
    cityPreferences,
    topKeywords,
    searchTodayCount,
    searchThisWeekCount,
    averageSearchesPerDay,
  } as SearchAnalyticsResponse)
}
