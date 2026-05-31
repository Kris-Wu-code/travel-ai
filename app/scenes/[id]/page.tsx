'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { formatTransportList, getSceneTypeLabel, type SceneRecord } from '../../lib/scenes'
import { useToast } from '../../components/toast'

type SceneDetail = SceneRecord & { poiCount: number }
type NavScene = { id: string; name: string }

function getMapPreviewUrl(lng: number, lat: number): string {
  return `https://restapi.amap.com/v3/staticmap?location=${lng},${lat}&zoom=14&size=600*280&markers=mid,,A:${lng},${lat}&key=661757d364c5bca839b4dae6d158709c`
}

export default function SceneDetailPage() {
  const router = useRouter()
  const toast = useToast()
  const params = useParams<{ id: string }>()
  const sceneId = Array.isArray(params.id) ? params.id[0] : params.id
  const [scene, setScene] = useState<SceneDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [wishlisted, setWishlisted] = useState(false)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [savingWishlist, setSavingWishlist] = useState(false)
  const [prevScene, setPrevScene] = useState<NavScene | null>(null)
  const [nextScene, setNextScene] = useState<NavScene | null>(null)

  useEffect(() => {
    async function loadScene() {
      if (!sceneId) { setError('缺少场景 ID'); setLoading(false); return }
      setLoading(true); setError(null)

      const [sceneResult, authResult, allScenesResult] = await Promise.all([
        supabase.from('scenes').select('id, name, scene_type, city, description, center_lat, center_lng, cover_image_url, available_transports, status, poi_count').eq('id', sceneId).maybeSingle(),
        supabase.auth.getUser(),
        supabase.from('scenes').select('id, name').eq('status', 'active').order('created_at', { ascending: false }).limit(1000),
      ])

      if (sceneResult.error) { setError(sceneResult.error.message); setLoading(false); return }
      if (!sceneResult.data) { setScene(null); setLoading(false); return }

      setScene({ ...sceneResult.data, poiCount: (sceneResult.data as any).poi_count ?? 0 })

      // Calculate prev/next
      const allScenes = (allScenesResult.data ?? []) as NavScene[]
      const idx = allScenes.findIndex(s => s.id === sceneId)
      if (idx > 0) setPrevScene(allScenes[idx - 1])
      else setPrevScene(null)
      if (idx >= 0 && idx < allScenes.length - 1) setNextScene(allScenes[idx + 1])
      else setNextScene(null)

      const userId = authResult.data?.user?.id ?? null
      setCurrentUserId(userId)

      const [wishlistTotalRes, userWishRes] = await Promise.all([
        supabase.from('bookmarks').select('id', { count: 'exact', head: true }).eq('target_type', 'wishlist').eq('target_id', sceneId),
        userId ? supabase.from('bookmarks').select('id').eq('user_id', userId).eq('target_type', 'wishlist').eq('target_id', sceneId).maybeSingle() : Promise.resolve({ data: null }),
      ])
      setWishlistCount(wishlistTotalRes.count ?? 0)
      setWishlisted(!!userWishRes.data)

      if (!userWishRes.data && userId) {
        const local = getLocalWishlist()
        if (local.includes(sceneId)) setWishlisted(true)
      }

      if (userId) {
        await supabase.from('scene_visit_logs').upsert({ user_id: userId, scene_id: sceneId, last_visited_at: new Date().toISOString() }, { onConflict: 'user_id,scene_id' })
      }

      setLoading(false)
    }
    loadScene()
  }, [sceneId])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && prevScene) router.push(`/scenes/${prevScene.id}`)
      if (e.key === 'ArrowRight' && nextScene) router.push(`/scenes/${nextScene.id}`)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prevScene, nextScene, router])

  function getLocalWishlist(): string[] {
    try { return JSON.parse(localStorage.getItem('travel-ai:wishlist') || '[]') } catch { return [] }
  }

  async function handleToggleWishlist() {
    if (!currentUserId) { router.push(`/auth/login?next=/scenes/${sceneId}`); return }
    setSavingWishlist(true)
    const nextState = !wishlisted
    setWishlisted(nextState)
    setWishlistCount(prev => nextState ? prev + 1 : Math.max(0, prev - 1))
    try {
      if (!nextState) {
        await supabase.from('bookmarks').delete().eq('user_id', currentUserId).eq('target_type', 'wishlist').eq('target_id', sceneId)
      } else {
        const { error } = await supabase.from('bookmarks').upsert({ user_id: currentUserId, target_type: 'wishlist', target_id: sceneId }, { onConflict: 'user_id,target_type,target_id' })
        if (error) { const list = getLocalWishlist(); if (nextState) list.push(sceneId); else { const i = list.indexOf(sceneId); if (i >= 0) list.splice(i, 1) }; localStorage.setItem('travel-ai:wishlist', JSON.stringify(list)) }
      }
    } catch {} finally { setSavingWishlist(false) }
  }

  const hasCoords = scene?.center_lat != null && scene?.center_lng != null

  return (
    <div style={shell}>
      {/* Top bar */}
      <div style={topBar}>
        <a href="/" style={backLink}>← 返回首页</a>
        <div style={navArea}>
          {prevScene ? (
            <button onClick={() => router.push(`/scenes/${prevScene.id}`)} style={navBtn} title={prevScene.name}>
              ← {prevScene.name.slice(0, 8)}
            </button>
          ) : <div />}
          <span style={navHint}>← 键盘 → 翻页</span>
          {nextScene ? (
            <button onClick={() => router.push(`/scenes/${nextScene.id}`)} style={navBtn} title={nextScene.name}>
              {nextScene.name.slice(0, 8)} →
            </button>
          ) : <div />}
        </div>
      </div>

      {loading ? (
        <div style={s.card}><div style={s.center}>加载中...</div></div>
      ) : error ? (
        <div style={s.card}><div style={s.cardTitle}>加载失败</div><p style={s.text}>{error}</p></div>
      ) : scene ? (
        <>
          {/* Hero with cover image */}
          <div style={s.hero} className="scene-hero">
            {scene.cover_image_url ? <img src={scene.cover_image_url} alt={scene.name} className="scene-hero-cover" /> : null}
            <div className="scene-hero-overlay" />
            <div className="scene-hero-content">
              <div style={s.heroLabel}>{getSceneTypeLabel(scene.scene_type)}</div>
              <div style={s.heroName}>{scene.name}</div>
              <div style={s.heroMeta}>{scene.city ?? '未填写城市'}</div>
              <button type="button" onClick={handleToggleWishlist} disabled={savingWishlist} className="wishlist-btn">
                <span className={wishlisted ? 'wishlist-icon active' : 'wishlist-icon'}>{wishlisted ? '❤️' : '🤍'}</span>
                <span>{wishlisted ? '已想去' : '想去'}</span>
                {wishlistCount > 0 ? <span className="wishlist-badge">{wishlistCount > 999 ? '999+' : wishlistCount}</span> : null}
              </button>
            </div>
          </div>

          {/* Main content: 2-column layout */}
          <div style={mainGrid}>
            {/* Left column: info + actions */}
            <div style={s.col}>
              <div style={s.card}>
                <div style={s.cardTitle}>场景说明</div>
                <div style={s.text}>{scene.description ?? '暂无场景说明'}</div>
                <div style={s.metaGrid}>
                  <div style={s.metaItem}><span style={s.metaLabel}>可用交通</span><span>{formatTransportList(scene.available_transports)}</span></div>
                  <div style={s.metaItem}><span style={s.metaLabel}>POI 数量</span><span>{scene.poiCount > 0 ? scene.poiCount : '暂无'}</span></div>
                  {hasCoords ? <div style={s.metaItem}><span style={s.metaLabel}>坐标</span><span>{scene.center_lat!.toFixed(4)}, {scene.center_lng!.toFixed(4)}</span></div> : null}
                </div>
              </div>

              <div style={s.actions}>
                <button onClick={() => router.push(`/itinerary?dest=${encodeURIComponent(scene.name)}`)} style={{ ...s.btn, ...s.btnPrimary }}>✈️ 生成行程</button>
                <button onClick={() => router.push('/foods')} style={s.btn}>🍜 美食推荐</button>
                <button onClick={() => router.push(`/diary?sceneId=${scene.id}`)} style={s.btn}>📖 查看日记</button>
                <button onClick={() => router.push(`/diary/write?sceneId=${scene.id}`)} style={s.btn}>✏️ 写日记</button>
              </div>
            </div>

            {/* Right column: map */}
            <aside style={s.mapCard}>
              <div style={s.mapThumb}>
                {hasCoords ? (
                  <a href={`/navigation?mode=real-world&destName=${encodeURIComponent(scene.name)}&destLat=${scene.center_lat}&destLng=${scene.center_lng}`}
                    style={{ ...s.mapEntry, backgroundImage: `url(${getMapPreviewUrl(scene.center_lng!, scene.center_lat!)})` }}>
                    <div style={s.mapCta}>🗺️ 打开地图与导航</div>
                  </a>
                ) : (
                  <div style={s.mapPlaceholder}>暂无坐标，无法预览地图</div>
                )}
              </div>
              <div style={s.mapNote}>点击跳转真实地图导航，定位到此景点</div>
            </aside>
          </div>
        </>
      ) : (
        <div style={s.card}><div style={s.cardTitle}>场景不存在</div><p style={s.text}>数据库中未找到此场景。</p></div>
      )}

      {/* Bottom pagination */}
      {(prevScene || nextScene) ? (
        <div style={bottomNav}>
          {prevScene ? (
            <button onClick={() => router.push(`/scenes/${prevScene.id}`)} style={pageBtn}>
              ← {prevScene.name}
            </button>
          ) : <div />}
          {nextScene ? (
            <button onClick={() => router.push(`/scenes/${nextScene.id}`)} style={{ ...pageBtn, textAlign: 'right' }}>
              {nextScene.name} →
            </button>
          ) : <div />}
        </div>
      ) : null}
    </div>
  )
}

const shell: React.CSSProperties = {
  minHeight: '100vh', background: 'linear-gradient(180deg, #f7fbfa 0%, #f0f5f4 100%)',
  padding: '16px 40px 40px', maxWidth: '1400px', margin: '0 auto',
}

const topBar: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: '16px', flexWrap: 'wrap', gap: '8px',
}

const backLink: React.CSSProperties = {
  textDecoration: 'none', color: '#0b8f7a', fontWeight: 700, fontSize: '14px',
}

const navArea: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '12px',
}

const navBtn: React.CSSProperties = {
  padding: '6px 14px', borderRadius: '8px', border: '1px solid #e5e7eb',
  background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
}

const navHint: React.CSSProperties = {
  fontSize: '11px', color: '#9ca3af',
}

const mainGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px', alignItems: 'start',
}

const bottomNav: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', marginTop: '24px', gap: '16px',
}

const pageBtn: React.CSSProperties = {
  flex: 1, padding: '14px 20px', borderRadius: '14px',
  border: '1px solid #e5e7eb', background: '#fff', color: '#111827',
  cursor: 'pointer', fontWeight: 600, fontSize: '14px', textAlign: 'left',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}

const s: Record<string, React.CSSProperties> = {
  hero: { borderRadius: '18px', padding: '40px', color: '#fff', position: 'relative', overflow: 'hidden', minHeight: '300px', display: 'flex', alignItems: 'flex-end', marginBottom: '24px' },
  heroLabel: { fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', opacity: 0.85, marginBottom: '8px' },
  heroName: { fontSize: '36px', fontWeight: 800, marginBottom: '6px', lineHeight: 1.05 },
  heroMeta: { fontSize: '15px', opacity: 0.85 },
  col: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: { background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardTitle: { fontSize: '17px', fontWeight: 700, color: '#111827', marginBottom: '12px' },
  text: { fontSize: '15px', lineHeight: 1.8, color: '#4b5563', margin: 0 },
  metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '18px', padding: '14px', background: '#f9fafb', borderRadius: '12px' },
  metaItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  metaLabel: { fontSize: '12px', color: '#6b7280', fontWeight: 500 },
  actions: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' },
  btn: { padding: '15px 16px', borderRadius: '14px', border: '1px solid #e5e7eb', background: '#fff', color: '#111827', cursor: 'pointer', fontWeight: 600, fontSize: '14px', textAlign: 'center' as const },
  btnPrimary: { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none' },
  mapCard: { background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  mapThumb: { height: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b', position: 'relative' },
  mapEntry: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', textDecoration: 'none', backgroundSize: 'cover', backgroundPosition: 'center' },
  mapCta: { background: 'rgba(0,0,0,0.55)', padding: '10px 18px', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 700, backdropFilter: 'blur(4px)' },
  mapPlaceholder: { color: '#9ca3af', fontSize: '14px' },
  mapNote: { padding: '12px 16px', fontSize: '12px', color: '#6b7280', textAlign: 'center', borderTop: '1px solid #f3f4f6' },
  center: { textAlign: 'center', color: '#9ca3af' },
}
