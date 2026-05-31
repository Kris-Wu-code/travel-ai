import { supabase } from './supabase'

export type Bookmark = {
  id: string
  sceneId: string
  sceneName: string
  city: string | null
  createdAt: string
}

export async function loadUserBookmarks(): Promise<Bookmark[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('bookmarks')
      .select('id, scene_id, scene_name, city, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error || !data) return []

    return data.map((item: any) => ({
      id: item.id,
      sceneId: item.scene_id,
      sceneName: item.scene_name,
      city: item.city,
      createdAt: item.created_at,
    }))
  } catch {
    return []
  }
}

export async function addBookmark(sceneId: string, sceneName: string, city: string | null | undefined): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { error } = await supabase.from('bookmarks').insert({
      user_id: user.id,
      scene_id: sceneId,
      scene_name: sceneName,
      city: city || null,
    })

    return !error
  } catch {
    return false
  }
}

export async function removeBookmark(sceneId: string): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('scene_id', sceneId)

    return !error
  } catch {
    return false
  }
}

export async function checkBookmark(sceneId: string): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { data, error } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('scene_id', sceneId)
      .single()

    return !error && !!data
  } catch {
    return false
  }
}
