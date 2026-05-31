import { NextResponse } from 'next/server'
import { createAdminClient } from '@/app/lib/supabase'

export const dynamic = 'force-dynamic'

async function fetchAllSceneIds(table: string, filter: Record<string, any>) {
  const supabase = createAdminClient()
  const allIds: string[] = []
  const PAGE = 1000
  let page = 0

  while (true) {
    let query = supabase.from(table).select('scene_id').range(page * PAGE, (page + 1) * PAGE - 1)
    for (const [key, val] of Object.entries(filter)) {
      query = query.eq(key, val)
    }
    const { data } = await query
    if (!data || data.length === 0) break
    allIds.push(...data.map((r: any) => r.scene_id))
    if (data.length < PAGE) break
    page++
  }

  return allIds
}

export async function GET() {
  try {
    const [poiIds, navIds] = await Promise.all([
      fetchAllSceneIds('poi_items', { status: 'approved' }),
      fetchAllSceneIds('scene_pois', { is_active: true }),
    ])

    const countMap: Record<string, number> = {}
    for (const id of [...poiIds, ...navIds]) {
      if (!id) continue
      countMap[id] = (countMap[id] || 0) + 1
    }

    return NextResponse.json({ counts: countMap })
  } catch {
    return NextResponse.json({ counts: {} }, { status: 500 })
  }
}
