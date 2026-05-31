import { NextResponse } from 'next/server'
import { createAdminClient } from '@/app/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const since = new Date()
    since.setDate(since.getDate() - 30)

    const { data } = await supabase.from('search_events')
      .select('keyword').gte('created_at', since.toISOString()).limit(10000)

    const count = new Map<string, number>()
    for (const row of data ?? []) {
      const kw = (row.keyword || '').trim()
      if (!kw || kw === '__all__') continue
      count.set(kw, (count.get(kw) || 0) + 1)
    }

    const sorted = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16)
    const max = sorted[0]?.[1] || 1

    return NextResponse.json({
      keywords: sorted.map(([keyword, cnt]) => ({
        keyword, count: cnt,
        size: Math.min(28, 12 + Math.round((cnt / max) * 14)),
      })),
    })
  } catch {
    return NextResponse.json({ keywords: [] }, { status: 500 })
  }
}
