'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import PageShell from '../components/page-shell'
import { formatTransportList, getSceneTypeLabel, type SceneRecord } from '../lib/scenes'

type Food = {
  id: string
  name: string
  cuisine_type: string
  canteen_name: string | null
  window_name: string
  price_range: string
  avg_rating: number
  hot_score: number
  scene_id: string | null
}

export default function FoodsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [foods, setFoods] = useState<Food[]>([])
  const [scenes, setScenes] = useState<SceneRecord[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingScenes, setLoadingScenes] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('全部')

  const cuisines = ['全部', '川菜', '粤菜', '快餐', '清真', '日料']

  useEffect(() => {
    async function loadScenes() {
      setLoadingScenes(true)

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
    async function loadFoods() {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('food_items')
        .select('id, name, cuisine_type, canteen_name, window_name, price_range, avg_rating, hot_score, scene_id')
        .eq('status', 'approved')
        .order('hot_score', { ascending: false })
        .limit(20)

      if (selectedSceneId) {
        query = query.eq('scene_id', selectedSceneId)
      }

      if (filter !== '全部') {
        query = query.eq('cuisine_type', filter)
      }

      const { data, error } = await query
      if (error) {
        setError(error.message)
      }

      if (!error && data) setFoods(data)
      setLoading(false)
    }

    loadFoods()
  }, [filter, selectedSceneId])

  const selectedScene = useMemo(
    () => scenes.find(scene => scene.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId],
  )

  return (
    <PageShell backHref="/dashboard" title="美食推荐" subtitle="探索当地美味">
      <div>
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
                style={styles.sceneSelect}
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

        <div style={styles.filterRow}>
          {cuisines.map(c => (
            <button
              key={c}
              style={{
                ...styles.filterBtn,
                background: filter === c ? '#4f46e5' : '#fff',
                color: filter === c ? '#fff' : '#6b7280',
                borderColor: filter === c ? '#4f46e5' : '#e5e7eb',
              }}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={styles.empty}>加载中...</div>
        ) : error ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyTitle}>美食数据加载失败</div>
            <div style={styles.emptyDesc}>{error}</div>
          </div>
        ) : foods.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🍜</div>
            <div style={styles.emptyTitle}>暂无美食数据</div>
            <div style={styles.emptyDesc}>当前场景或菜系下还没有录入美食</div>
          </div>
        ) : (
          <div style={styles.grid}>
            {foods.map(food => (
              <div key={food.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <span style={styles.foodName}>{food.name}</span>
                  {food.cuisine_type && (
                    <span style={styles.tag}>{food.cuisine_type}</span>
                  )}
                </div>
                {food.canteen_name && (
                  <div style={styles.location}>
                    🏢 {food.canteen_name}
                    {food.window_name && ` · ${food.window_name}`}
                  </div>
                )}
                <div style={styles.cardFooter}>
                  {food.price_range && (
                    <span style={styles.price}>💴 {food.price_range}元</span>
                  )}
                  {food.avg_rating && (
                    <span style={styles.rating}>⭐ {food.avg_rating}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  content: {
    padding: '40px 24px',
  },
  filterRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '28px',
    flexWrap: 'wrap',
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
  sceneSelect: {
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
  filterBtn: {
    padding: '7px 16px',
    borderRadius: '20px',
    border: '1px solid',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    padding: '60px 0',
  },
  emptyCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '60px',
    textAlign: 'center',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px',
  },
  emptyDesc: {
    fontSize: '14px',
    color: '#9ca3af',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  foodName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e',
    flex: 1,
  },
  tag: {
    fontSize: '12px',
    padding: '2px 8px',
    background: '#fff7ed',
    color: '#d97706',
    borderRadius: '20px',
    fontWeight: '500',
    marginLeft: '8px',
    whiteSpace: 'nowrap',
  },
  location: {
    fontSize: '13px',
    color: '#6b7280',
  },
  cardFooter: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
  },
  price: {
    fontSize: '13px',
    color: '#059669',
  },
  rating: {
    fontSize: '13px',
    color: '#d97706',
  },
}
