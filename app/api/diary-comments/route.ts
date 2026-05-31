import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const diaryId = new URL(request.url).searchParams.get('diaryId')
  if (!diaryId) return NextResponse.json({ error: 'Missing diaryId' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: comments } = await supabase.from('diary_comments')
    .select('id, content, created_at, user_id, parent_id')
    .eq('diary_id', diaryId).order('created_at', { ascending: true }).limit(100)

  const userIds = [...new Set((comments ?? []).map(c => c.user_id))]
  const nameMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds)
    profiles?.forEach((p: any) => nameMap.set(p.user_id, p.display_name || '匿名'))
  }

  return NextResponse.json({
    comments: (comments ?? []).map(c => ({ ...c, author: nameMap.get(c.user_id) || '匿名' })),
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { diary_id, content, parent_id } = body
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')

  // Use anon client for auth verification
  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false } })
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use admin client for DB insert (bypasses RLS)
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('diary_comments').insert({
    diary_id, user_id: user.id, content, parent_id: parent_id || null,
  }).select('id, content, created_at, user_id, parent_id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: data })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false } })
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: existing } = await supabase.from('diary_comments').select('user_id').eq('id', id).single()
  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('diary_comments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
