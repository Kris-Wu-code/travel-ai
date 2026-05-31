import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type SearchSuggestion = {
  id: string
  name: string
  city: string | null
  searchCount: number
}

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q) {
    return NextResponse.json({ suggestions: [] })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Missing Supabase environment variables' },
      { status: 500 },
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 获取过去30天的搜索热度数据
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceIso = since.toISOString()

  const { data: searchEvents } = await supabase
    .from('search_events')
    .select('keyword')
    .gte('created_at', sinceIso)

  // 统计搜索频次
  const searchHotness = new Map<string, number>()
  if (searchEvents) {
    for (const event of searchEvents) {
      const kw = event.keyword?.trim().toLowerCase() || ''
      if (kw) {
        searchHotness.set(kw, (searchHotness.get(kw) ?? 0) + 1)
      }
    }
  }

  // 查询匹配的景区
  const { data: scenes, error } = await supabase
    .from('scenes')
    .select('id, name, city')
    .eq('status', 'active')
    .or(`name.ilike.%${q}%,city.ilike.%${q}%`)
    .limit(100)

  if (error || !scenes) {
    return NextResponse.json({ suggestions: [] })
  }

  // 添加热度分数并排序
  const withHotness: SearchSuggestion[] = scenes
    .map(scene => ({
      ...scene,
      searchCount: searchHotness.get(scene.name.toLowerCase()) ?? 0,
    }))
    .sort((a, b) => {
      // 首先按搜索热度排序（降序）
      if (b.searchCount !== a.searchCount) {
        return b.searchCount - a.searchCount
      }
      // 如果热度相同，按名称长度（更具体的优先）
      if (a.name.length !== b.name.length) {
        return a.name.length - b.name.length
      }
      // 最后按字母序
      return a.name.localeCompare(b.name)
    })
    .slice(0, 8)

  return NextResponse.json({ suggestions: withHotness })
}
