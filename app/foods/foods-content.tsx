'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PageShell from '../components/page-shell'
import { supabase } from '../lib/supabase'
import { formatTransportList, getSceneTypeLabel, type SceneRecord } from '../lib/scenes'

type Food = {
  id: string
  name: string
  cuisine_type: string | null
  canteen_name: string | null
  window_name: string | null
  price_range: string | null
  avg_rating: number | null
  hot_score: number | null
  scene_id: string | null
}

export default function FoodsContent() {
  const searchParams = useSearchParams()
  const [foods, setFoods] = useState<Food[]>([])
  const [scenes, setScenes] = useState<SceneRecord[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingScenes, setLoadingScenes] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('全部')

  const cuisines = ['全部', '川菜', '粤菜', '快餐', '清真', '日料', '咖啡', '甜品']

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

      const nextScenes = (data ?? []) as SceneRecord[]
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
        .limit(30)

      if (selectedSceneId) {
        query = query.eq('scene_id', selectedSceneId)
      }

      if (filter !== '全部') {
        query = query.eq('cuisine_type', filter)
      }

      const { data, error: queryError } = await query

      if (queryError) {
        setError(queryError.message)
        setFoods([])
      } else {
        setFoods((data ?? []) as Food[])
      }

      setLoading(false)
    }

    loadFoods()
  }, [filter, selectedSceneId])

  const selectedScene = useMemo(
    () => scenes.find(scene => scene.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId],
  )

  return (
    <PageShell backHref="/dashboard" title="美食推荐" subtitle="探索当前场景下的热门美食">
      <div style={styles.wrap}>
        <div style={styles.scenePanel}>
          <div style={styles.panelTitle}>当前场景</div>
          {loadingScenes ? (
            <div style={styles.panelText}>正在加载场景...</div>
          ) : error ? (
            <div style={styles.panelText}>{error}</div>
          ) : scenes.length === 0 ? (
            <div style={styles.panelText}>暂无可用场景，请先导入 scenes 数据。</div>
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

        <div style={styles.filterRow}>
          {cuisines.map(item => (
            <button
              key={item}
              style={item === filter ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={styles.empty}>加载中...</div>
        ) : error ? (
          <div style={styles.empty}>{error}</div>
        ) : foods.length === 0 ? (
          <div style={styles.empty}>当前筛选下暂无美食数据</div>
        ) : (
          <div style={styles.grid}>
            {foods.map(food => (
              <div key={food.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.name}>{food.name}</div>
                  {food.cuisine_type ? <span style={styles.tag}>{food.cuisine_type}</span> : null}
                </div>
                {food.canteen_name ? (
                  <div style={styles.meta}>地点：{food.canteen_name}{food.window_name ? ` · ${food.window_name}` : ''}</div>
                ) : null}
                <div style={styles.metaRow}>
                  {food.price_range ? <span>价格：{food.price_range}</span> : null}
                  {typeof food.avg_rating === 'number' ? <span>评分：{food.avg_rating.toFixed(1)}</span> : null}
                  {typeof food.hot_score === 'number' ? <span>热度：{food.hot_score}</span> : null}
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
  wrap: {
    display: 'grid',
    gap: '16px',
  },
  scenePanel: {
    background: '#fff',
    borderRadius: '14px',
    padding: '16px',
    border: '1px solid #e5e7eb',
  },
  panelTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '10px',
  },
  panelText: {
    fontSize: '14px',
    color: '#6b7280',
  },
  select: {
    width: '100%',
    maxWidth: '420px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    marginBottom: '12px',
  },
  sceneSummary: {
    padding: '12px',
    borderRadius: '10px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
  },
  sceneName: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '6px',
  },
  sceneMeta: {
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: 1.7,
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  filterBtn: {
    padding: '8px 12px',
    borderRadius: '999px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  filterBtnActive: {
    padding: '8px 12px',
    borderRadius: '999px',
    border: '1px solid #4f46e5',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
  },
  empty: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '20px',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  grid: {
    display: 'grid',
    gap: '12px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start',
  },
  name: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827',
  },
  tag: {
    fontSize: '12px',
    padding: '3px 8px',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#4338ca',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  meta: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#6b7280',
  },
  metaRow: {
    marginTop: '10px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    fontSize: '13px',
    color: '#4b5563',
  },
}
