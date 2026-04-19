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

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Missing Supabase environment variables' },
      { status: 500 },
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data, error } = await supabase
    .from('sync_jobs')
    .select('id, job_name, status, started_at, finished_at, duration_ms, scenes_count, amap_request_count, amap_rate_limited_count, amap_failed_count, poi_written_count, food_written_count, error_message, created_at')
    .eq('job_name', 'seed-amap')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const jobs = (data ?? []) as SyncJobRow[]
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
  })
}
