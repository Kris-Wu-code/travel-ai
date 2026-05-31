import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { diary_id, action } = await request.json()
  if (!diary_id || !['like', 'unlike'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const inc = action === 'like' ? 1 : -1

  // Get current count
  const { data: current } = await supabase.from('diaries').select('likes_count').eq('id', diary_id).single()
  const newCount = Math.max(0, (current?.likes_count || 0) + inc)

  const { error } = await supabase.from('diaries').update({ likes_count: newCount }).eq('id', diary_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ likes_count: newCount, liked: action === 'like' })
}
