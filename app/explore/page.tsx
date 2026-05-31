'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import PageShell from '../components/page-shell'

type Scene = {
  id: string
  name: string
  scene_type: string
  city: string | null
  description: string | null
  cover_image_url: string | null
  poiCount: number
}

type Profile = {
  travel_style: string[] | null
  budget_level: number | null
  group_type: string | null
  preferences: { taboos?: string[]; travel_pace?: string } | null
  questionnaire_done: boolean | null
}

const STYLE_KEYWORDS: Record<string, string[]> = {
  culture: ['文化', '历史', '博物', '古迹', '寺庙', '故宫', '长城', '遗址', '陵', '祠', '博物馆', '纪念馆', '石窟', '古城'],
  nature: ['自然', '山', '湖', '海', '河', '森林', '温泉', '瀑布', '草原', '雪山', '峡谷', '湿地', '峰', '岛', '沙漠', '冰川'],
  food: ['美食', '小吃', '街', '夜市', '火锅', '海鲜', '餐厅', '茶', '咖啡'],
  city: ['城市', '都市', '广场', '步行街', '商圈', 'CBD', '外滩', '陆家嘴', '三里屯', '太古里'],
  relax: ['度假', '温泉', 'SPA', '休闲', '海滩', '慢', '悠', '湖景', '阳光', '躺', '茶馆'],
  adventure: ['探险', '徒步', '攀岩', '滑雪', '漂流', '骑行', '越野', '潜水', '滑翔', '露营', '极限'],
  shopping: ['购物', '商圈', '步行街', '免税', '奥特莱斯', '集市', '商场', '文创'],
  photo: ['日出', '日落', '云海', '花海', '梯田', '古镇', '老街', '拍摄', '观景', '晚霞'],
  family_fun: ['乐园', '动物', '海洋', '游乐', '亲子', '科技馆', '水族馆'],
  nightlife: ['夜景', '酒吧', '夜市', '夜游', '不夜', '灯光', '烟花'],
}

const TABOO_KEYWORDS: Record<string, string[]> = {
  no_spicy: ['辣', '川菜', '湘菜'],
  no_seafood: ['海鲜', '渔', '舟山', '青岛'],
  no_pork: ['猪肉', '红烧肉'],
  no_beef: ['牛肉', '牛排'],
  no_meat: ['肉', '荤'],
  no_climb: ['山', '爬山', '攀登', '徒步', '登顶', '峰', '海拔'],
  no_crowd: ['热门', '网红', '打卡', '排队'],
  no_night: ['夜景', '夜游', '夜市', '酒吧'],
  no_altitude: ['高原', '雪山', '海拔', '西藏', '稻城', '色达'],
  no_heat: ['沙漠', '热带', '海滩暴晒', '戈壁'],
}

function computeScore(scene: Scene, profile: Profile | null): number {
  let score = (scene.poiCount || 0) * 2
  if (!profile?.questionnaire_done) return score

  const haystack = `${scene.name} ${scene.description ?? ''} ${scene.city ?? ''}`.toLowerCase()
  const styles = profile.travel_style ?? []

  for (const style of styles) {
    const keywords = STYLE_KEYWORDS[style]
    if (!keywords) continue
    for (const kw of keywords) {
      if (haystack.includes(kw)) score += 5
    }
  }

  const taboos = profile.preferences?.taboos ?? []
  for (const taboo of taboos) {
    const keywords = TABOO_KEYWORDS[taboo]
    if (!keywords) continue
    for (const kw of keywords) {
      if (haystack.includes(kw)) score -= 15
    }
  }

  if (profile.group_type === 'family') {
    if (haystack.includes('乐园') || haystack.includes('动物') || haystack.includes('亲子') || haystack.includes('科技馆')) score += 10
  }
  if (profile.group_type === 'couple') {
    if (haystack.includes('浪漫') || haystack.includes('日落') || haystack.includes('夜景') || haystack.includes('温泉')) score += 8
  }

  const pace = profile.preferences?.travel_pace
  if (pace === 'slow' && scene.poiCount && scene.poiCount < 5) score += 4
  if (pace === 'packed' && scene.poiCount && scene.poiCount > 20) score += 4

  return score
}

function getRecommendReason(scene: Scene, profile: Profile | null): string | null {
  if (!profile?.questionnaire_done || !profile.travel_style?.length) return null
  const haystack = `${scene.name} ${scene.description ?? ''} ${scene.city ?? ''}`.toLowerCase()

  for (const style of profile.travel_style) {
    const keywords = STYLE_KEYWORDS[style]
    if (!keywords) continue
    for (const kw of keywords) {
      if (haystack.includes(kw)) {
        const styleLabel: Record<string, string> = {
          culture: '文化历史', nature: '自然风光', food: '美食之旅', city: '都市探索',
          relax: '休闲度假', adventure: '户外探险', shopping: '购物之旅',
          photo: '摄影打卡', family_fun: '亲子乐园', nightlife: '夜生活',
        }
        return `匹配「${styleLabel[style] || style}」偏好`
      }
    }
  }
  return '综合推荐'
}

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1549893074-35c4f79b1c65?auto=format&fit=crop&w=600&h=340&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&h=340&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&h=340&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&h=340&q=80',
  'https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=600&h=340&q=80',
  'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=600&h=340&q=80',
]

const BATCH_SIZE = 10

export default function ExplorePage() {
  const router = useRouter()
  const [scenes, setScenes] = useState<Scene[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  function handleRefresh() {
    setRefreshKey(prev => prev + 1)
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)

      const { data: authData } = await supabase.auth.getUser()
      let userProfile: Profile | null = null

      if (authData.user) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('travel_style, budget_level, group_type, preferences, questionnaire_done')
          .eq('user_id', authData.user.id)
          .maybeSingle()
        if (profileRow) userProfile = profileRow as Profile
      }
      setProfile(userProfile)

      const { data: sceneData, error: sceneErr } = await supabase
        .from('scenes').select('id, name, scene_type, city, description, cover_image_url, poi_count').eq('status', 'active')
      if (sceneErr) { setError(sceneErr.message); setLoading(false); return }

      setScenes((sceneData ?? []).map((s: any) => ({
        id: s.id, name: s.name, scene_type: s.scene_type,
        city: s.city, description: s.description, cover_image_url: s.cover_image_url,
        poiCount: s.poi_count ?? 0,
      })))
      setLoading(false)
    }

    loadData()
  }, [])

  // Trigger random shuffle on initial page load (client-side only)
  useEffect(() => {
    if (!loading && refreshKey === 0) {
      setRefreshKey(Math.floor(Math.random() * 10000) + 1)
    }
  }, [loading, refreshKey])

  const scoredScenes = useMemo(() => {
    return scenes
      .map(scene => ({ ...scene, score: computeScore(scene, profile) }))
      .sort((a, b) => b.score - a.score)
  }, [scenes, profile])

  const recommendedScenes = useMemo(
    () => (profile?.questionnaire_done ? scoredScenes.filter(s => s.score > (s.poiCount || 0) * 2) : []),
    [scoredScenes, profile],
  )

  // Always ensure enough scenes to show: if recommendations are too few, pad with top-scored rest
  const pool = useMemo(() => {
    if (showAll || recommendedScenes.length === 0) return scoredScenes
    if (recommendedScenes.length >= BATCH_SIZE) return recommendedScenes
    const recIds = new Set(recommendedScenes.map(s => s.id))
    const rest = scoredScenes.filter(s => !recIds.has(s.id))
    return [...recommendedScenes, ...rest]
  }, [showAll, recommendedScenes, scoredScenes])

  const displayScenes = useMemo(() => {
    // Use refreshKey to trigger a fresh random shuffle each time
    void refreshKey
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, BATCH_SIZE)
  }, [pool, refreshKey])

  const typeLabel = (type: string) => type === 'scenic_spot' ? '🏔️ 景区' : '🎓 校园'

  function getImage(scene: Scene, index: number): string {
    if (scene.cover_image_url) return scene.cover_image_url
    return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]
  }

  return (
    <PageShell backHref="/" title="探索推荐" subtitle={profile?.questionnaire_done ? '根据你的偏好，为你精选目的地' : '发现热门景区和校园'} contentMaxWidth="820px">
      <div style={s.content}>
        {!loading && !profile?.questionnaire_done ? (
          <div style={s.banner}>
            <div style={s.bannerIcon}>🎯</div>
            <div>
              <div style={s.bannerTitle}>完成偏好问卷，获得更精准的推荐</div>
              <div style={s.bannerDesc}>当前按 POI 丰富度排序。花 1 分钟填问卷，系统会为你匹配最合适的景区。</div>
            </div>
            <button style={s.bannerBtn} onClick={() => router.push('/onboarding')}>去填写</button>
          </div>
        ) : null}

        <div style={s.sectionHeader}>
          <div style={s.sectionTitle}>
            {recommendedScenes.length > 0 ? '✨ 为你推荐' : '🔥 热门景区'}
            <span style={s.sectionCount}>{pool.length > 99 ? '99+' : pool.length} 个可选，展示 {displayScenes.length} 个</span>
          </div>
          <div style={s.headerBtns}>
            <button type="button" onClick={handleRefresh} style={s.refreshBtn}>
              🔄 换一批
            </button>
            {recommendedScenes.length > 0 ? (
              <button type="button" onClick={() => { setShowAll(prev => !prev); handleRefresh() }} style={s.toggleBtn}>
                {showAll ? '只看推荐' : '查看全部'}
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div style={s.empty}>正在为你生成推荐...</div>
        ) : error ? (
          <div style={s.emptyCard}>
            <div style={s.emptyTitle}>加载失败</div>
            <div style={s.emptyDesc}>{error}</div>
          </div>
        ) : scenes.length === 0 ? (
          <div style={s.emptyCard}>
            <div style={s.emptyIcon}>🗺️</div>
            <div style={s.emptyTitle}>暂无景点数据</div>
            <div style={s.emptyDesc}>管理员还没有录入景点，敬请期待</div>
          </div>
        ) : (
          <div style={s.grid}>
            {displayScenes.map((scene, i) => {
              const reason = getRecommendReason(scene, profile)
              const isRecommended = recommendedScenes.some(r => r.id === scene.id)
              const image = getImage(scene, i)
              return (
                <button
                  key={scene.id}
                  type="button"
                  style={s.card}
                  onClick={() => router.push(`/scenes/${scene.id}`)}
                >
                  <div style={{ ...s.cardImage, backgroundImage: `url(${image})` }} />
                  <div style={s.cardBody}>
                    <div style={s.cardTop}>
                      <span style={s.tag}>{typeLabel(scene.scene_type)}</span>
                      {scene.city ? <span style={s.city}>{scene.city}</span> : null}
                    </div>
                    <div style={s.cardName}>{scene.name}</div>
                    {scene.description ? (
                      <div style={s.cardDesc}>{scene.description.slice(0, 60)}{scene.description.length > 60 ? '...' : ''}</div>
                    ) : null}
                    <div style={s.cardFooter}>
                      {isRecommended && reason ? <span style={s.reasonTag}>{reason}</span> : null}
                      <span style={s.poiStat}>📍 {scene.poiCount} 个 POI</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </PageShell>
  )
}

const s: Record<string, React.CSSProperties> = {
  content: { width: '100%' },
  banner: {
    display: 'flex', alignItems: 'center', gap: '16px',
    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
    borderRadius: '16px', padding: '20px 24px', marginBottom: '24px',
    color: '#fff', flexWrap: 'wrap',
  },
  bannerIcon: { fontSize: '36px', flexShrink: 0 },
  bannerTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '4px' },
  bannerDesc: { fontSize: '13px', opacity: 0.85, lineHeight: 1.5 },
  bannerBtn: {
    marginLeft: 'auto', padding: '10px 20px', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)',
    color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '16px', flexWrap: 'wrap', gap: '10px',
  },
  sectionTitle: { fontSize: '18px', fontWeight: 700, color: '#111827' },
  sectionCount: { marginLeft: '8px', fontSize: '13px', fontWeight: 400, color: '#6b7280' },
  headerBtns: { display: 'flex', gap: '8px' },
  refreshBtn: {
    padding: '8px 18px', borderRadius: '999px', border: '1px solid #4f46e5',
    background: '#eef2ff', color: '#4f46e5', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  },
  toggleBtn: {
    padding: '8px 16px', borderRadius: '999px', border: '1px solid #d1d5db',
    background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
  },
  empty: { textAlign: 'center', color: '#9ca3af', padding: '60px 0' },
  emptyCard: {
    background: '#fff', borderRadius: '16px', padding: '60px', textAlign: 'center',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  emptyIcon: { fontSize: '48px', marginBottom: '12px' },
  emptyTitle: { fontSize: '18px', fontWeight: 600, color: '#374151', marginBottom: '8px' },
  emptyDesc: { fontSize: '14px', color: '#9ca3af' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
  },
  card: {
    display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left',
    background: '#fff', borderRadius: '16px', overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', cursor: 'pointer',
    border: 'none', transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  cardImage: {
    width: '100%', height: '180px', backgroundSize: 'cover', backgroundPosition: 'center',
    flexShrink: 0,
  },
  cardBody: { padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  cardTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  tag: {
    fontSize: '12px', padding: '3px 10px', background: '#eef2ff',
    color: '#4f46e5', borderRadius: '20px', fontWeight: 500,
  },
  city: { fontSize: '13px', color: '#9ca3af' },
  cardName: { fontSize: '17px', fontWeight: 700, color: '#1a1a2e' },
  cardDesc: { fontSize: '13px', color: '#6b7280', lineHeight: 1.5, flex: 1 },
  cardFooter: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: 'auto' },
  reasonTag: {
    fontSize: '11px', padding: '3px 8px', background: '#ecfdf5', color: '#047857',
    borderRadius: '999px', fontWeight: 600,
  },
  poiStat: { fontSize: '12px', color: '#9ca3af' },
}
