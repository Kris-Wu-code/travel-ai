import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type SyncJobRow = {
  id: string
  job_name: string
  status: 'success' | 'failed'
  started_at: string
  finished_at: string
  duration_ms: number
  scenes_count: number
  amap_request_count: number
  amap_rate_limited_count: number
  amap_failed_count: number
  poi_written_count: number
  food_written_count: number
  error_message: string | null
  created_at: string
}

type TrendPoint = {
  date: string
  success: number
  failed: number
  poiWritten: number
}

type SearchEventRow = {
  keyword: string
  has_suggestion_match: boolean
  created_at: string
}

type SearchAnalyticsPayload = {
  totalSearches: number
  noMatchSearches: number
  noMatchRate: number
  topKeywords: Array<{ keyword: string; count: number }>
  topNoMatchKeywords: Array<{ keyword: string; count: number }>
} | null

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const daysParam = searchParams.get('days')
  const daysFilter = Math.max(1, Math.min(90, parseInt(daysParam || '30', 10)))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Missing Supabase environment variables' },
      { status: 500 },
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  let searchAnalytics: SearchAnalyticsPayload = null

  const { data, error } = await supabase
    .from('sync_jobs')
    .select('id, job_name, status, started_at, finished_at, duration_ms, scenes_count, amap_request_count, amap_rate_limited_count, amap_failed_count, poi_written_count, food_written_count, error_message, created_at')
    .eq('job_name', 'seed-amap')
    .order('created_at', { ascending: false })
    .limit(120)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const allJobs = (data ?? []) as SyncJobRow[]
  const jobs = allJobs.slice(0, 20)
  const total = jobs.length
  const successCount = jobs.filter(job => job.status === 'success').length
  const failedCount = jobs.filter(job => job.status === 'failed').length
  const successRate = total > 0 ? Number(((successCount / total) * 100).toFixed(1)) : 0

  const durationSamples = jobs
    .map(job => Number(job.duration_ms || 0))
    .filter(value => Number.isFinite(value) && value > 0)
  const avgDurationMs = durationSamples.length > 0
    ? Math.round(durationSamples.reduce((sum, value) => sum + value, 0) / durationSamples.length)
    : 0

  const lastSuccess = jobs.find(job => job.status === 'success')

  const trendMap = new Map<string, TrendPoint>()
  const today = new Date()
  const last7Keys: string[] = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    last7Keys.push(key)
    trendMap.set(key, {
      date: key,
      success: 0,
      failed: 0,
      poiWritten: 0,
    })
  }

  for (const job of allJobs) {
    const key = new Date(job.created_at).toISOString().slice(0, 10)
    const point = trendMap.get(key)
    if (!point) continue
    if (job.status === 'success') {
      point.success += 1
    } else {
      point.failed += 1
    }
    point.poiWritten += Number(job.poi_written_count || 0)
  }

  const trends = last7Keys
    .map(key => trendMap.get(key))
    .filter((item): item is TrendPoint => Boolean(item))

  const since = new Date()
  since.setDate(since.getDate() - daysFilter)
  const sinceIso = since.toISOString()

  const { data: searchEventRows, error: searchError } = await supabase
    .from('search_events')
    .select('keyword, has_suggestion_match, created_at')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(1200)

  if (!searchError && Array.isArray(searchEventRows)) {
    const rows = searchEventRows as SearchEventRow[]
    const totalSearches = rows.length
    const noMatchRows = rows.filter(item => !item.has_suggestion_match)
    const noMatchSearches = noMatchRows.length
    const noMatchRate = totalSearches > 0 ? Number(((noMatchSearches / totalSearches) * 100).toFixed(1)) : 0

    const keywordCounter = new Map<string, number>()
    for (const item of rows) {
      const key = item.keyword || '__all__'
      keywordCounter.set(key, (keywordCounter.get(key) ?? 0) + 1)
    }

    const noMatchCounter = new Map<string, number>()
    for (const item of noMatchRows) {
      const key = item.keyword || '__all__'
      noMatchCounter.set(key, (noMatchCounter.get(key) ?? 0) + 1)
    }

    searchAnalytics = {
      totalSearches,
      noMatchSearches,
      noMatchRate,
      topKeywords: [...keywordCounter.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([keyword, count]) => ({ keyword, count })),
      topNoMatchKeywords: [...noMatchCounter.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([keyword, count]) => ({ keyword, count })),
    }
  }

  return NextResponse.json({
    summary: {
      total,
      successCount,
      failedCount,
      successRate,
      avgDurationMs,
      lastSuccessAt: lastSuccess?.finished_at ?? null,
    },
    jobs,
    trends,
    searchAnalytics,
  })
}
