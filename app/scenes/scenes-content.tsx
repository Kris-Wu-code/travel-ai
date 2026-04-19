'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import PageShell from '../components/page-shell'
import { formatTransportList, getSceneTypeLabel, type SceneRecord, type SceneType } from '../lib/scenes'

type SceneCard = SceneRecord & {
  poiCount: number | null
}

type SceneSortKey = 'newest' | 'name_asc' | 'poi_desc'
type RecommendReason = 'recent_visit' | 'poi_rich'
type RecommendStrategy = 'recent_first' | 'poi_first'

type FilterSnapshot = {
  id: string
  keyword: string
  sceneTypeFilter: 'all' | SceneType
  cityFilter: string
  sortKey: SceneSortKey
}

type RecommendedScene = SceneCard & {
  recommendReason: RecommendReason
}

const RECENT_FILTERS_KEY = 'travel-ai:recent-scene-filters'

function parseSceneTypeFilter(value: string | null): 'all' | SceneType {
  if (value === 'scenic_spot' || value === 'campus') {
    return value
  }

  return 'all'
}

function parseSortKey(value: string | null): SceneSortKey {
  if (value === 'name_asc' || value === 'poi_desc') {
    return value
  }

  return 'newest'
}

function parseRecommendStrategy(value: string | null): RecommendStrategy {
  if (value === 'poi_first') {
    return 'poi_first'
  }

  return 'recent_first'
}

export default function ScenesContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [scenes, setScenes] = useState<SceneCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState(() => searchParams.get('q') ?? '')
  const [sceneTypeFilter, setSceneTypeFilter] = useState<'all' | SceneType>(() => parseSceneTypeFilter(searchParams.get('type')))
  const [cityFilter, setCityFilter] = useState(() => searchParams.get('city') ?? 'all')
  const [sortKey, setSortKey] = useState<SceneSortKey>(() => parseSortKey(searchParams.get('sort')))
  const [filtersExpanded, setFiltersExpanded] = useState(true)
  const [recentFilters, setRecentFilters] = useState<FilterSnapshot[]>([])
  const [recentVisitedSceneIds, setRecentVisitedSceneIds] = useState<string[]>([])
  const [recommendStrategy, setRecommendStrategy] = useState<RecommendStrategy>(() => parseRecommendStrategy(searchParams.get('rec')))
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)

  useEffect(() => {
    async function loadScenes() {
      setLoading(true)

      // 查询最后的导入时间
      const { data: syncJobs } = await supabase
        .from('sync_jobs')
        .select('finished_at')
        .eq('status', 'success')
        .order('finished_at', { ascending: false })
        .limit(1)

      if (syncJobs && syncJobs.length > 0) {
        const finishedAt = new Date(syncJobs[0].finished_at)
        const localTime = finishedAt.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
        setLastSyncTime(localTime)
      }

      setError(null)

      const [{ data: authData }, sceneResult, poiResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('scenes')
          .select('id, name, scene_type, city, description, center_lat, center_lng, cover_image_url, available_transports, status')
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase
          .from('poi_items')
          .select('scene_id')
          .eq('status', 'approved'),
      ])

      if (sceneResult.error) {
        setError(sceneResult.error.message)
        setLoading(false)
        return
      }

      const poiCountMap = new Map<string, number>()
      if (!poiResult.error && poiResult.data) {
        for (const item of poiResult.data) {
          if (!item.scene_id) continue
          poiCountMap.set(item.scene_id, (poiCountMap.get(item.scene_id) ?? 0) + 1)
        }
      }

      const nextScenes = (sceneResult.data ?? []).map(scene => ({
        ...scene,
        poiCount: poiCountMap.get(scene.id) ?? null,
      }))

      const userId = authData.user?.id
      if (userId) {
        const { data: visitRows } = await supabase
          .from('scene_visit_logs')
          .select('scene_id, last_visited_at')
          .eq('user_id', userId)
          .order('last_visited_at', { ascending: false })
          .limit(6)

        const visitedIds = (visitRows ?? []).map(row => row.scene_id).filter((id): id is string => typeof id === 'string' && id.length > 0)
        setRecentVisitedSceneIds(visitedIds)
      } else {
        setRecentVisitedSceneIds([])
      }

      setScenes(nextScenes)
      setLoading(false)
    }

    loadScenes()
  }, [])

  const cityOptions = useMemo(() => {
    const citySet = new Set<string>()
    for (const scene of scenes) {
      const city = scene.city?.trim()
      if (city) {
        citySet.add(city)
      }
    }

    return Array.from(citySet).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }, [scenes])

  const filteredScenes = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    let nextScenes = scenes.filter(scene => {
      if (sceneTypeFilter !== 'all' && scene.scene_type !== sceneTypeFilter) {
        return false
      }

      if (cityFilter !== 'all' && (scene.city ?? '') !== cityFilter) {
        return false
      }

      if (!normalizedKeyword) {
        return true
      }

      const haystack = `${scene.name} ${scene.city ?? ''} ${scene.description ?? ''}`.toLowerCase()
      return haystack.includes(normalizedKeyword)
    })

    nextScenes = [...nextScenes]

    if (sortKey === 'name_asc') {
      nextScenes.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    } else if (sortKey === 'poi_desc') {
      nextScenes.sort((a, b) => (b.poiCount ?? 0) - (a.poiCount ?? 0))
    }

    return nextScenes
  }, [scenes, keyword, sceneTypeFilter, cityFilter, sortKey])

  const hasActiveFilter = keyword.trim().length > 0 || sceneTypeFilter !== 'all' || cityFilter !== 'all' || sortKey !== 'newest'

  const quickTagCities = useMemo(() => cityOptions.slice(0, 4), [cityOptions])

  const recommendedScenes = useMemo<RecommendedScene[]>(() => {
    const sceneById = new Map<string, SceneCard>()
    for (const scene of scenes) {
      sceneById.set(scene.id, scene)
    }

    const result: RecommendedScene[] = []
    const used = new Set<string>()

    const hotByPoi = [...scenes].sort((a, b) => (b.poiCount ?? 0) - (a.poiCount ?? 0))

    const primaryPool = recommendStrategy === 'recent_first'
      ? recentVisitedSceneIds
      : hotByPoi.map(item => item.id)
    const secondaryPool = recommendStrategy === 'recent_first'
      ? hotByPoi.map(item => item.id)
      : recentVisitedSceneIds

    for (const sceneId of primaryPool) {
      const scene = sceneById.get(sceneId)
      if (scene && !used.has(scene.id)) {
        result.push({
          ...scene,
          recommendReason: recommendStrategy === 'recent_first' ? 'recent_visit' : 'poi_rich',
        })
        used.add(scene.id)
      }
      if (result.length >= 4) {
        return result
      }
    }

    for (const sceneId of secondaryPool) {
      const scene = sceneById.get(sceneId)
      if (!scene) {
        continue
      }

      if (used.has(scene.id)) {
        continue
      }

      result.push({
        ...scene,
        recommendReason: recommendStrategy === 'recent_first' ? 'poi_rich' : 'recent_visit',
      })
      used.add(scene.id)
      if (result.length >= 4) {
        break
      }
    }

    return result
  }, [scenes, recentVisitedSceneIds, recommendStrategy])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const raw = window.localStorage.getItem(RECENT_FILTERS_KEY)
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as FilterSnapshot[]
      if (!Array.isArray(parsed)) {
        return
      }

      const safeFilters = parsed.filter(item => (
        typeof item?.id === 'string'
        && typeof item?.keyword === 'string'
        && (item?.sceneTypeFilter === 'all' || item?.sceneTypeFilter === 'scenic_spot' || item?.sceneTypeFilter === 'campus')
        && typeof item?.cityFilter === 'string'
        && (item?.sortKey === 'newest' || item?.sortKey === 'name_asc' || item?.sortKey === 'poi_desc')
      ))

      setRecentFilters(safeFilters.slice(0, 3))
    } catch {
      window.localStorage.removeItem(RECENT_FILTERS_KEY)
    }
  }, [])

  useEffect(() => {
    if (cityFilter === 'all') {
      return
    }

    if (!cityOptions.includes(cityFilter)) {
      setCityFilter('all')
    }
  }, [cityOptions, cityFilter])

  useEffect(() => {
    const nextParams = new URLSearchParams()

    const normalizedKeyword = keyword.trim()
    if (normalizedKeyword) {
      nextParams.set('q', normalizedKeyword)
    }

    if (sceneTypeFilter !== 'all') {
      nextParams.set('type', sceneTypeFilter)
    }

    if (cityFilter !== 'all') {
      nextParams.set('city', cityFilter)
    }

    if (sortKey !== 'newest') {
      nextParams.set('sort', sortKey)
    }

    if (recommendStrategy !== 'recent_first') {
      nextParams.set('rec', recommendStrategy)
    }

    const nextQuery = nextParams.toString()
    const currentQuery = searchParams.toString()
    if (nextQuery === currentQuery) {
      return
    }

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname)
  }, [keyword, sceneTypeFilter, cityFilter, sortKey, recommendStrategy, pathname, router, searchParams])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!hasActiveFilter) {
      return
    }

    const normalizedKeyword = keyword.trim()
    const signature = `${normalizedKeyword}|${sceneTypeFilter}|${cityFilter}|${sortKey}`

    setRecentFilters(previous => {
      const withoutDup = previous.filter(item => item.id !== signature)
      const next: FilterSnapshot[] = [
        {
          id: signature,
          keyword: normalizedKeyword,
          sceneTypeFilter,
          cityFilter,
          sortKey,
        },
        ...withoutDup,
      ].slice(0, 3)

      window.localStorage.setItem(RECENT_FILTERS_KEY, JSON.stringify(next))
      return next
    })
  }, [keyword, sceneTypeFilter, cityFilter, sortKey, hasActiveFilter])

  useEffect(() => {
    const nextKeyword = searchParams.get('q') ?? ''
    const nextSceneTypeFilter = parseSceneTypeFilter(searchParams.get('type'))
    const nextCityFilter = searchParams.get('city') ?? 'all'
    const nextSortKey = parseSortKey(searchParams.get('sort'))
    const nextRecommendStrategy = parseRecommendStrategy(searchParams.get('rec'))

    setKeyword(previous => previous === nextKeyword ? previous : nextKeyword)
    setSceneTypeFilter(previous => previous === nextSceneTypeFilter ? previous : nextSceneTypeFilter)
    setCityFilter(previous => previous === nextCityFilter ? previous : nextCityFilter)
    setSortKey(previous => previous === nextSortKey ? previous : nextSortKey)
    setRecommendStrategy(previous => previous === nextRecommendStrategy ? previous : nextRecommendStrategy)
  }, [searchParams])

  function resetFilters() {
    setKeyword('')
    setSceneTypeFilter('all')
    setCityFilter('all')
    setSortKey('newest')
  }

  function applyRecentFilter(filter: FilterSnapshot) {
    setKeyword(filter.keyword)
    setSceneTypeFilter(filter.sceneTypeFilter)
    setCityFilter(filter.cityFilter)
    setSortKey(filter.sortKey)
  }

  function removeRecentFilter(filterId: string) {
    setRecentFilters(previous => {
      const next = previous.filter(item => item.id !== filterId)

      if (typeof window !== 'undefined') {
        if (next.length > 0) {
          window.localStorage.setItem(RECENT_FILTERS_KEY, JSON.stringify(next))
        } else {
          window.localStorage.removeItem(RECENT_FILTERS_KEY)
        }
      }

      return next
    })
  }

  function describeFilter(filter: FilterSnapshot) {
    const fragments: string[] = []
    if (filter.keyword) {
      fragments.push(`关键词:${filter.keyword}`)
    }
    if (filter.sceneTypeFilter !== 'all') {
      fragments.push(filter.sceneTypeFilter === 'scenic_spot' ? '景区' : '校园')
    }
    if (filter.cityFilter !== 'all') {
      fragments.push(filter.cityFilter)
    }
    if (filter.sortKey === 'poi_desc') {
      fragments.push('POI优先')
    } else if (filter.sortKey === 'name_asc') {
      fragments.push('名称排序')
    }

    return fragments.join(' · ') || '默认筛选'
  }

  function getRecommendReasonLabel(reason: RecommendReason) {
    return reason === 'recent_visit' ? '最近访问' : 'POI丰富'
  }

  const recommendStrategyDescription = recommendStrategy === 'recent_first'
    ? '当前策略：优先最近访问，其次按 POI 丰富度补齐。'
    : '当前策略：优先 POI 丰富度，其次补充你最近访问过的场景。'

  return (
    <PageShell backHref="/dashboard" title="场景选择" subtitle="先选定当前场景，再进入导航、场所查询和美食推荐">
      <div>
        <div style={styles.banner}>
          <div style={styles.bannerTitle}>景区 / 校园 双场景入口</div>
          <div style={styles.bannerDesc}>后续所有行中功能都从这里分发</div>
        </div>

        {lastSyncTime ? (
          <div style={styles.syncTimeBar}>
            <span>📊 数据更新时间：{lastSyncTime}</span>
          </div>
        ) : null}

        {!loading && !error && recommendedScenes.length > 0 ? (
          <div style={styles.recommendPanel}>
            <div style={styles.recommendHeader}>
              <div>
                <div style={styles.recommendTitle}>为你推荐</div>
                <div style={styles.recommendDesc}>{recommendStrategyDescription}</div>
              </div>
              <div style={styles.strategyBtnGroup}>
                <button
                  style={recommendStrategy === 'recent_first' ? styles.strategyBtnActive : styles.strategyBtn}
                  onClick={() => setRecommendStrategy('recent_first')}
                >
                  最近优先
                </button>
                <button
                  style={recommendStrategy === 'poi_first' ? styles.strategyBtnActive : styles.strategyBtn}
                  onClick={() => setRecommendStrategy('poi_first')}
                >
                  POI优先
                </button>
              </div>
            </div>
            <div style={styles.recommendGrid}>
              {recommendedScenes.map(scene => (
                <button
                  key={scene.id}
                  style={styles.recommendCard}
                  onClick={() => router.push(`/scenes/${scene.id}`)}
                >
                  <div style={styles.recommendReasonBadge}>{getRecommendReasonLabel(scene.recommendReason)}</div>
                  <div style={styles.recommendName}>{scene.name}</div>
                  <div style={styles.recommendMeta}>{getSceneTypeLabel(scene.scene_type)} · {scene.city ?? '未填写城市'}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div style={styles.filterPanel}>
          <div style={styles.filterHeader}>
            <div style={styles.filterTitleWrap}>
              <div style={styles.filterTitle}>筛选与排序</div>
              <div style={styles.filterSubtitle}>支持关键词、类型、城市和快捷标签</div>
            </div>
            <button
              style={styles.collapseBtn}
              onClick={() => setFiltersExpanded(previous => !previous)}
            >
              {filtersExpanded ? '收起筛选' : '展开筛选'}
            </button>
          </div>

          {filtersExpanded ? (
            <>
              <div style={styles.filterGrid}>
                <input
                  value={keyword}
                  onChange={event => setKeyword(event.target.value)}
                  placeholder="搜索场景名 / 城市 / 关键词"
                  style={styles.searchInput}
                />

                <select
                  value={sceneTypeFilter}
                  onChange={event => setSceneTypeFilter(event.target.value as 'all' | SceneType)}
                  style={styles.select}
                >
                  <option value="all">全部类型</option>
                  <option value="scenic_spot">仅景区</option>
                  <option value="campus">仅校园</option>
                </select>

                <select
                  value={cityFilter}
                  onChange={event => setCityFilter(event.target.value)}
                  style={styles.select}
                >
                  <option value="all">全部城市</option>
                  {cityOptions.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>

                <select
                  value={sortKey}
                  onChange={event => setSortKey(event.target.value as SceneSortKey)}
                  style={styles.select}
                >
                  <option value="newest">排序：最新创建</option>
                  <option value="name_asc">排序：名称 A-Z</option>
                  <option value="poi_desc">排序：POI 数量高优先</option>
                </select>
              </div>

              <div style={styles.quickTagRow}>
                <button
                  style={sceneTypeFilter === 'scenic_spot' ? styles.quickTagBtnActive : styles.quickTagBtn}
                  onClick={() => setSceneTypeFilter(previous => previous === 'scenic_spot' ? 'all' : 'scenic_spot')}
                >
                  热门：景区
                </button>
                <button
                  style={sceneTypeFilter === 'campus' ? styles.quickTagBtnActive : styles.quickTagBtn}
                  onClick={() => setSceneTypeFilter(previous => previous === 'campus' ? 'all' : 'campus')}
                >
                  热门：校园
                </button>
                <button
                  style={sortKey === 'poi_desc' ? styles.quickTagBtnActive : styles.quickTagBtn}
                  onClick={() => setSortKey(previous => previous === 'poi_desc' ? 'newest' : 'poi_desc')}
                >
                  热门：POI 多优先
                </button>
                {quickTagCities.map(city => (
                  <button
                    key={city}
                    style={cityFilter === city ? styles.quickTagBtnActive : styles.quickTagBtn}
                    onClick={() => setCityFilter(previous => previous === city ? 'all' : city)}
                  >
                    城市：{city}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <div style={styles.filterMetaRow}>
            <div style={styles.filterMetaText}>当前展示 {filteredScenes.length} / {scenes.length} 个场景</div>
            {hasActiveFilter ? (
              <button style={styles.resetBtn} onClick={resetFilters}>重置筛选</button>
            ) : null}
          </div>

          {recentFilters.length > 0 ? (
            <div style={styles.recentFilterRow}>
              <div style={styles.recentFilterLabel}>最近使用：</div>
              <div style={styles.recentFilterList}>
                {recentFilters.map(filter => (
                  <div key={filter.id} style={styles.recentFilterPill}>
                    <button
                      style={styles.recentFilterBtn}
                      onClick={() => applyRecentFilter(filter)}
                    >
                      {describeFilter(filter)}
                    </button>
                    <button
                      style={styles.recentFilterDeleteBtn}
                      onClick={() => removeRecentFilter(filter.id)}
                      aria-label="删除该筛选组合"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div style={styles.emptyCard}>场景数据加载中...</div>
        ) : error ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyTitle}>场景数据加载失败</div>
            <div style={styles.emptyDesc}>{error}</div>
          </div>
        ) : scenes.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyTitle}>暂无可用场景</div>
            <div style={styles.emptyDesc}>数据库里还没有 status=active 的 scenes 数据</div>
          </div>
        ) : filteredScenes.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyTitle}>没有匹配的场景</div>
            <div style={styles.emptyDesc}>可以尝试放宽关键词或点击“重置筛选”。</div>
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredScenes.map(scene => (
              <button
                key={scene.id}
                style={styles.card}
                onClick={() => router.push(`/scenes/${scene.id}`)}
              >
                <div style={styles.cardTop}>
                  <span style={styles.badge}>{getSceneTypeLabel(scene.scene_type)}</span>
                  <span style={styles.city}>{scene.city ?? '未填写城市'}</span>
                </div>
                <div style={styles.name}>{scene.name}</div>
                <div style={styles.meta}>可用交通：{formatTransportList(scene.available_transports)}</div>
                <div style={styles.meta}>POI 数量：{scene.poiCount ?? '未统计'}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    background: 'linear-gradient(135deg, #1d4ed8, #0f766e)',
    color: '#fff',
    borderRadius: '18px',
    padding: '28px',
    marginBottom: '24px',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.16)',
  },
  bannerTitle: {
    fontSize: '22px',
    fontWeight: '700',
    marginBottom: '6px',
  },
  bannerDesc: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.82)',
  },
  syncTimeBar: {
    padding: '12px 16px',
    backgroundColor: '#f0f4f8',
    borderBottom: '1px solid #e0e7ff',
    fontSize: '13px',
    color: '#4a5568',
    textAlign: 'center' as const,
  },
  filterPanel: {
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    padding: '16px',
    marginBottom: '18px',
  },
  recommendPanel: {
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid #dbe2f1',
    padding: '16px',
    marginBottom: '16px',
  },
  recommendHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '10px',
    flexWrap: 'wrap',
  },
  recommendTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '4px',
  },
  recommendDesc: {
    fontSize: '13px',
    color: '#6b7280',
  },
  strategyBtnGroup: {
    display: 'inline-flex',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    overflow: 'hidden',
    background: '#fff',
  },
  strategyBtn: {
    border: 'none',
    background: '#fff',
    color: '#4b5563',
    fontSize: '12px',
    fontWeight: 600,
    padding: '6px 10px',
    cursor: 'pointer',
  },
  strategyBtnActive: {
    border: 'none',
    background: '#dbeafe',
    color: '#1e3a8a',
    fontSize: '12px',
    fontWeight: 700,
    padding: '6px 10px',
    cursor: 'pointer',
  },
  recommendGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
  },
  recommendCard: {
    textAlign: 'left',
    border: '1px solid #e5e7eb',
    background: '#f8fafc',
    borderRadius: '12px',
    padding: '12px',
    cursor: 'pointer',
  },
  recommendReasonBadge: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#1d4ed8',
    background: '#dbeafe',
    borderRadius: '999px',
    padding: '4px 8px',
    marginBottom: '8px',
  },
  recommendName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '4px',
  },
  recommendMeta: {
    fontSize: '12px',
    color: '#6b7280',
  },
  filterHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  filterTitleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  filterTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827',
  },
  filterSubtitle: {
    fontSize: '12px',
    color: '#6b7280',
  },
  collapseBtn: {
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    padding: '8px 12px',
    background: '#fff',
    color: '#1f2937',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
    marginBottom: '10px',
  },
  quickTagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '10px',
  },
  quickTagBtn: {
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    padding: '6px 10px',
    background: '#fff',
    color: '#374151',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  quickTagBtnActive: {
    border: '1px solid #1d4ed8',
    borderRadius: '999px',
    padding: '6px 10px',
    background: '#dbeafe',
    color: '#1e3a8a',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  searchInput: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
    background: '#fff',
    color: '#111827',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
    background: '#fff',
    color: '#111827',
  },
  filterMetaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  filterMetaText: {
    fontSize: '13px',
    color: '#6b7280',
  },
  resetBtn: {
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    padding: '8px 12px',
    background: '#fff',
    color: '#1f2937',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  recentFilterRow: {
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px dashed #e5e7eb',
  },
  recentFilterLabel: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '8px',
  },
  recentFilterList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  recentFilterPill: {
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    overflow: 'hidden',
    background: '#fff',
  },
  recentFilterBtn: {
    border: 'none',
    padding: '6px 10px',
    background: '#fff',
    color: '#374151',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  recentFilterDeleteBtn: {
    border: 'none',
    borderLeft: '1px solid #e5e7eb',
    background: '#fff',
    color: '#6b7280',
    width: '24px',
    height: '24px',
    fontSize: '14px',
    lineHeight: 1,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px',
  },
  card: {
    textAlign: 'left',
    background: '#fff',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    cursor: 'pointer',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  badge: {
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#4338ca',
    fontWeight: 600,
  },
  city: {
    fontSize: '13px',
    color: '#9ca3af',
  },
  name: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '8px',
  },
  meta: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '6px',
  },
  emptyCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '28px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    color: '#6b7280',
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '8px',
  },
  emptyDesc: {
    fontSize: '14px',
    lineHeight: 1.6,
  },
}
