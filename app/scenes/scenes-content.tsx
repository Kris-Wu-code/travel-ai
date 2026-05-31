'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import PageShell from '../components/page-shell'
import { getSceneTypeLabel, type SceneRecord } from '../lib/scenes'
import { SceneCardSkeleton } from '../components/skeleton'

type SceneCard = SceneRecord & { poiCount: number }

const STYLE_KW: Record<string, string[]> = {
  culture: ['文化', '历史', '博物', '古迹', '故宫', '长城', '遗址', '陵', '祠'],
  nature: ['自然', '山', '湖', '海', '森林', '温泉', '瀑布', '草原', '雪山', '峡谷', '湿地'],
  food: ['美食', '小吃', '街', '夜市', '火锅'],
  city: ['都市', '广场', '步行街', '商圈', '外滩'],
  relax: ['度假', '温泉', '休闲', '海滩', '慢'],
  adventure: ['探险', '徒步', '攀岩', '滑雪', '漂流'],
}

const HOT_CITIES = new Set(['北京', '上海', '杭州', '成都', '西安', '南京', '广州', '深圳', '厦门', '丽江', '重庆', '苏州'])

function recommendScore(s: SceneCard, profile: any, visitedIds: string[]): number {
  let score = (s.poiCount || 0) * 3
  const hay = `${s.name} ${s.description ?? ''} ${s.city ?? ''}`.toLowerCase()
  if (s.city && HOT_CITIES.has(s.city)) score += 10
  if (s.cover_image_url) score += 5
  if (visitedIds.includes(s.id)) score += 15
  const styles: string[] = profile?.travel_style ?? []
  for (const st of styles) {
    for (const kw of STYLE_KW[st] || []) {
      if (hay.includes(kw)) score += 8
    }
  }
  return score
}

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1549893074-35c4f79b1c65?auto=format&fit=crop&w=600&h=340&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&h=340&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&h=340&q=80',
]

export default function ScenesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [scenes, setScenes] = useState<SceneCard[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState(searchParams.get('q') ?? '')
  const [cityFilter, setCityFilter] = useState(searchParams.get('city') ?? 'all')
  const [sortKey, setSortKey] = useState<string>('recommend')
  const [userProfile, setUserProfile] = useState<any>(null)

  useEffect(() => {
    async function loadScenes() {
      setLoading(true)
      const [sceneResult, authRes] = await Promise.all([
        supabase.from('scenes').select('id, name, scene_type, city, description, cover_image_url, center_lat, center_lng, available_transports, poi_count, status').eq('status', 'active').order('poi_count', { ascending: false, nullsFirst: false }),
        supabase.auth.getUser(),
      ])
      if (sceneResult.error) return
      const uid = authRes.data?.user?.id
      let profile = null
      let visitedIds: string[] = []
      if (uid) {
        const [{ data: prof }, { data: visits }] = await Promise.all([
          supabase.from('profiles').select('travel_style, group_type').eq('user_id', uid).maybeSingle(),
          supabase.from('scene_visit_logs').select('scene_id').eq('user_id', uid).order('last_visited_at', { ascending: false }).limit(10),
        ])
        profile = prof
        visitedIds = (visits ?? []).map((v: any) => v.scene_id)
      }
      setUserProfile({ profile, visitedIds })

      let list = (sceneResult.data ?? []).map((s: any) => ({
        ...s, poiCount: s.poi_count ?? 0,
      }))
      // Pre-sort by recommend score
      list.sort((a, b) => recommendScore(b, profile, visitedIds) - recommendScore(a, profile, visitedIds))
      setScenes(list)
      setLoading(false)
    }
    loadScenes()
  }, [])

  const cities = useMemo(() => {
    const set = new Set<string>()
    scenes.forEach(s => { if (s.city) set.add(s.city) })
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }, [scenes])

  const filtered = useMemo(() => {
    let list = [...scenes]
    const kw = keyword.trim().toLowerCase()
    if (kw) list = list.filter(s => (s.name + ' ' + (s.city ?? '') + ' ' + (s.description ?? '')).toLowerCase().includes(kw))
    if (cityFilter !== 'all') list = list.filter(s => s.city === cityFilter)
    if (sortKey === 'recommend') list.sort((a, b) => recommendScore(b, userProfile?.profile, userProfile?.visitedIds) - recommendScore(a, userProfile?.profile, userProfile?.visitedIds))
    if (sortKey === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    if (sortKey === 'poi') list.sort((a, b) => b.poiCount - a.poiCount)
    return list
  }, [scenes, keyword, cityFilter, sortKey, userProfile])

  return (
    <PageShell backHref="/" title="景区选择" subtitle={`${filtered.length} 个景区`} contentMaxWidth="1300px">
      {/* Filter bar */}
      <div style={s.filterBar}>
        <div style={s.filterRow}>
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="🔍 搜索景区名称或城市..."
            style={s.searchInput}
          />
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={s.select}>
            <option value="all">全部城市 ({scenes.length})</option>
            {cities.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={s.select}>
            <option value="recommend">⭐ 推荐</option>
            <option value="poi">POI 最多</option>
            <option value="name">名称 A-Z</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={s.grid}>
          {Array.from({ length: 8 }).map((_, i) => <SceneCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={s.emptyCard}>
          <div style={s.emptyTitle}>没有匹配的景区</div>
          <div style={s.emptyDesc}>试试更换关键词或城市筛选</div>
        </div>
      ) : (
        <div style={s.grid}>
          {filtered.map((scene, i) => (
            <button key={scene.id} type="button" style={s.card} onClick={() => router.push(`/scenes/${scene.id}`)}>
              <div style={{ ...s.cardImg, backgroundImage: `url(${scene.cover_image_url || FALLBACK_IMAGES[i % 3]})` }} />
              <div style={s.cardBody}>
                <div style={s.cardTop}>
                  <span style={s.badge}>{getSceneTypeLabel(scene.scene_type)}</span>
                  {scene.city ? <span style={s.cardCity}>{scene.city}</span> : null}
                </div>
                <div style={s.cardName}>{scene.name}</div>
                {scene.description ? <div style={s.cardDesc}>{scene.description.slice(0, 60)}{scene.description.length > 60 ? '…' : ''}</div> : null}
                <div style={s.cardMeta}>
                  <span>📊 推荐值 {recommendScore(scene, userProfile?.profile, userProfile?.visitedIds)}</span>
                  <span>📍 {scene.poiCount > 0 ? scene.poiCount : '暂无'} POI</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </PageShell>
  )
}

const s: Record<string, React.CSSProperties> = {
  filterBar: { marginBottom: '20px' },
  filterRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  searchInput: {
    flex: '1 1 250px', padding: '10px 16px', borderRadius: '12px',
    border: '1px solid #e5e7eb', fontSize: '15px', outline: 'none', background: '#fff',
  },
  select: {
    padding: '10px 14px', borderRadius: '12px', border: '1px solid #e5e7eb',
    background: '#fff', fontSize: '14px', outline: 'none', minWidth: '130px',
  },
  empty: { textAlign: 'center', color: '#9ca3af', padding: '60px 0' },
  emptyCard: { background: '#fff', borderRadius: '16px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' },
  emptyTitle: { fontSize: '18px', fontWeight: 600, color: '#374151', marginBottom: '8px' },
  emptyDesc: { fontSize: '14px', color: '#9ca3af' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' },
  card: {
    display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left',
    background: '#fff', borderRadius: '16px', overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)', cursor: 'pointer', border: 'none',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  cardImg: {
    height: '170px', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0,
  },
  cardBody: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    fontSize: '12px', padding: '3px 10px', background: '#eef2ff',
    color: '#4f46e5', borderRadius: '20px', fontWeight: 500,
  },
  cardCity: { fontSize: '12px', color: '#9ca3af' },
  cardName: { fontSize: '16px', fontWeight: 700, color: '#111827', lineHeight: 1.3 },
  cardDesc: { fontSize: '13px', color: '#6b7280', lineHeight: 1.5, flex: 1 },
  cardMeta: { fontSize: '12px', color: '#9ca3af' },
}
