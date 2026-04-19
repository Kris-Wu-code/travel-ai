'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import PageShell from '../components/page-shell'
import { formatTransportList, getSceneTypeLabel, type SceneRecord } from '../lib/scenes'

type PoiItem = {
  id: string
  name: string
  category: string
  city: string | null
  address: string | null
  avg_rating: number | null
  review_count: number | null
  price_level: number | null
  tags: string[] | null
  scene_id: string | null
}

export default function PlacesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'nearby' | 'search'>('nearby')
  const [scenes, setScenes] = useState<SceneRecord[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState('')
  const [pois, setPois] = useState<PoiItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [loadingScenes, setLoadingScenes] = useState(true)
  const [loadingPois, setLoadingPois] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadScenes() {
      setLoadingScenes(true)
      setError(null)

      const { data, error: loadError } = await supabase
        .from('scenes')
        .select('id, name, scene_type, city, description, center_lat, center_lng, cover_image_url, available_transports, status')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (loadError) {
        setError(loadError.message)
        setLoadingScenes(false)
        return
      }

      const nextScenes = data ?? []
      setScenes(nextScenes)

      const urlSceneId = searchParams.get('sceneId') ?? ''
      setSelectedSceneId(previous => previous || urlSceneId || nextScenes[0]?.id || '')
      setLoadingScenes(false)
    }

    loadScenes()
  }, [searchParams])

  useEffect(() => {
    async function loadPois() {
      if (!selectedSceneId) {
        setPois([])
        return
      }

      setLoadingPois(true)
      setError(null)

      const { data, error: loadError } = await supabase
        .from('poi_items')
        .select('id, name, category, city, address, avg_rating, review_count, price_level, tags, scene_id')
        .eq('status', 'approved')
        .eq('scene_id', selectedSceneId)
        .order('avg_rating', { ascending: false, nullsFirst: false })
        .limit(24)

      if (loadError) {
        setError(loadError.message)
        setLoadingPois(false)
        return
      }

      setPois(data ?? [])
      setLoadingPois(false)
    }

    loadPois()
  }, [selectedSceneId])

  const selectedScene = useMemo(
    () => scenes.find(scene => scene.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId],
  )

  const filteredPois = useMemo(() => {
    const lowerKeyword = keyword.trim().toLowerCase()

    return pois.filter(poi => {
      if (!lowerKeyword) {
        return true
      }

      const haystack = [poi.name, poi.category, poi.city ?? '', poi.address ?? '', ...(poi.tags ?? [])]
        .join(' ')
        .toLowerCase()

      return haystack.includes(lowerKeyword)
    })
  }, [keyword, pois])

  return (
    <PageShell backHref="/dashboard" title="场所查询" subtitle="按图最短路径距离排序附近设施">
      <div>
        <div style={styles.segmentRow}>
          <button style={mode === 'nearby' ? styles.segmentActive : styles.segment} onClick={() => setMode('nearby')}>附近设施</button>
          <button style={mode === 'search' ? styles.segmentActive : styles.segment} onClick={() => setMode('search')}>设施搜索</button>
        </div>

        <div style={styles.scenePanel}>
          <div style={styles.panelTitle}>当前场景</div>
          {loadingScenes ? (
            <div style={styles.panelText}>正在加载场景...</div>
          ) : error ? (
            <div style={styles.panelText}>{error}</div>
          ) : scenes.length === 0 ? (
            <div style={styles.panelText}>还没有可用的场景数据，请先导入 scenes。</div>
          ) : (
            <>
              <select
                style={styles.select}
                value={selectedSceneId}
                onChange={event => setSelectedSceneId(event.target.value)}
              >
                {scenes.map(scene => (
                  <option key={scene.id} value={scene.id}>
                    {scene.name}
                  </option>
                ))}
              </select>

              {selectedScene ? (
                <div style={styles.sceneSummary}>
                  <div style={styles.sceneName}>{selectedScene.name}</div>
                  <div style={styles.sceneMeta}>
                    {getSceneTypeLabel(selectedScene.scene_type)} · {selectedScene.city ?? '未填写城市'}
                  </div>
                  <div style={styles.sceneMeta}>可用交通：{formatTransportList(selectedScene.available_transports)}</div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {mode === 'nearby' && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>附近设施查询</div>
            <div style={styles.cardText}>这里先按当前场景展示已审核通过的 POI，后续再替换成按图最短路径排序。</div>

            {loadingPois ? (
              <div style={styles.empty}>加载附近设施中...</div>
            ) : filteredPois.length === 0 ? (
              <div style={styles.empty}>当前场景下暂无可展示的设施</div>
            ) : (
              <div style={styles.poiList}>
                {filteredPois.map(poi => (
                  <div key={poi.id} style={styles.poiCard}>
                    <div style={styles.poiHeader}>
                      <div style={styles.poiName}>{poi.name}</div>
                      <span style={styles.poiTag}>{poi.category}</span>
                    </div>
                    <div style={styles.poiMeta}>{poi.city ?? '未填写城市'}</div>
                    {poi.address ? <div style={styles.poiMeta}>{poi.address}</div> : null}
                    <div style={styles.poiFooter}>
                      <span>⭐ {poi.avg_rating ?? '暂无'}</span>
                      <span>👁 {poi.review_count ?? 0}</span>
                      {poi.price_level ? <span>¥ {poi.price_level}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'search' && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>设施搜索</div>
            <div style={styles.cardText}>这里先做前端模糊搜索，后续再替换成 KMP / Trie 算法检索。</div>
            <input
              style={styles.input}
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              placeholder="输入名称、分类、标签或地址"
            />

            {loadingPois ? (
              <div style={styles.empty}>搜索数据加载中...</div>
            ) : filteredPois.length === 0 ? (
              <div style={styles.empty}>没有找到匹配的场所</div>
            ) : (
              <div style={styles.poiList}>
                {filteredPois.map(poi => (
                  <div key={poi.id} style={styles.poiCard}>
                    <div style={styles.poiHeader}>
                      <div style={styles.poiName}>{poi.name}</div>
                      <span style={styles.poiTag}>{poi.category}</span>
                    </div>
                    <div style={styles.poiMeta}>{poi.address ?? poi.city ?? '未填写地址'}</div>
                    <div style={styles.poiFooter}>
                      <span>⭐ {poi.avg_rating ?? '暂无'}</span>
                      <span>🏷 {poi.tags?.slice(0, 2).join(' / ') ?? '无标签'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={styles.quickLinks}>
          <button style={styles.quickBtn} onClick={() => router.push('/scenes')}>去选场景</button>
          <button style={styles.quickBtn} onClick={() => router.push('/navigation')}>去导航</button>
          <button style={styles.quickBtn} onClick={() => router.push(selectedSceneId ? `/foods?sceneId=${selectedSceneId}` : '/foods')}>去看美食</button>
        </div>
      </div>
    </PageShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  content: {
    padding: '40px 24px',
  },
  segmentRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '18px',
  },
  segment: {
    padding: '10px 16px',
    borderRadius: '999px',
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
    color: '#374151',
    fontWeight: 600,
  },
  segmentActive: {
    padding: '10px 16px',
    borderRadius: '999px',
    border: '1px solid #4f46e5',
    background: '#4f46e5',
    cursor: 'pointer',
    color: '#fff',
    fontWeight: 600,
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '8px',
  },
  cardText: {
    fontSize: '14px',
    lineHeight: 1.8,
    color: '#4b5563',
  },
  scenePanel: {
    background: '#fff',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    marginBottom: '16px',
  },
  panelTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '10px',
  },
  panelText: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: 1.7,
  },
  select: {
    width: '100%',
    maxWidth: '420px',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid #dbe2f1',
    marginBottom: '14px',
    background: '#fff',
    color: '#111827',
  },
  sceneSummary: {
    padding: '16px',
    borderRadius: '14px',
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
  },
  sceneName: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '6px',
  },
  sceneMeta: {
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: 1.7,
  },
  quickLinks: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '2px',
  },
  quickBtn: {
    padding: '12px 18px',
    borderRadius: '12px',
    border: '1px solid #dbe2f1',
    background: '#fff',
    color: '#111827',
    cursor: 'pointer',
    fontWeight: 600,
  },
  input: {
    width: '100%',
    maxWidth: '480px',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid #dbe2f1',
    marginTop: '12px',
    marginBottom: '16px',
    fontSize: '14px',
    outline: 'none',
  },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    padding: '22px 0',
    fontSize: '14px',
  },
  poiList: {
    display: 'grid',
    gap: '12px',
  },
  poiCard: {
    background: '#fff',
    borderRadius: '14px',
    padding: '16px',
    border: '1px solid #e5e7eb',
  },
  poiHeader: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  poiName: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827',
  },
  poiTag: {
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#4338ca',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  poiMeta: {
    marginTop: '6px',
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: 1.6,
  },
  poiFooter: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '10px',
    fontSize: '13px',
    color: '#9ca3af',
  },
}
