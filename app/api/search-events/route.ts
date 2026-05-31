import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_SOURCES = new Set(['enter', 'button', 'suggestion', 'hot', 'recent', 'fallback'])

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing Supabase environment variables' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const payload = (body ?? {}) as {
    keyword?: unknown
    source?: unknown
    hasSuggestionMatch?: unknown
  }

  const keyword = typeof payload.keyword === 'string' ? payload.keyword.trim().slice(0, 80) : ''
  const source = typeof payload.source === 'string' ? payload.source : 'button'
  const hasSuggestionMatch = Boolean(payload.hasSuggestionMatch)

  if (!ALLOWED_SOURCES.has(source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { error } = await supabase
    .from('search_events')
    .insert({
      keyword: keyword || '__all__',
      source,
      has_suggestion_match: hasSuggestionMatch,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
