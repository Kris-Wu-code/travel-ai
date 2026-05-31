import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type BookmarkRequest = {
  sceneId: string
  sceneName: string
  city?: string | null
  action: 'add' | 'remove' | 'check'
}

export async function POST(request: Request) {
  try {
    const body: BookmarkRequest = await request.json()
    const { sceneId, sceneName, city, action } = body

    if (!sceneId || !sceneName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing Supabase environment variables' },
        { status: 500 },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify token
    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (action === 'check') {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('scene_id', sceneId)
        .single()

      return NextResponse.json({
        isBookmarked: !error && !!data,
      })
    }

    if (action === 'add') {
      const { error } = await supabase.from('bookmarks').insert({
        user_id: user.id,
        scene_id: sceneId,
        scene_name: sceneName,
        city: city || null,
      })

      if (error && !error.message.includes('duplicate')) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, isBookmarked: true })
    }

    if (action === 'remove') {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('scene_id', sceneId)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, isBookmarked: false })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
