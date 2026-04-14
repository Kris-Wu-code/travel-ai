'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import PageShell from '../components/page-shell'
import { formatTransportList, getSceneTypeLabel, type SceneRecord } from '../lib/scenes'

type SceneCard = SceneRecord & {
  poiCount: number | null
}

export default function ScenesPage() {
  const router = useRouter()
  const [scenes, setScenes] = useState<SceneCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadScenes() {
      setLoading(true)
      setError(null)

      const [sceneResult, poiResult] = await Promise.all([
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

      setScenes(nextScenes)
      setLoading(false)
    }

    loadScenes()
  }, [])

  return (
    <PageShell backHref="/dashboard" title="场景选择" subtitle="先选定当前场景，再进入导航、场所查询和美食推荐">
      <div>
        <div style={styles.banner}>
          <div style={styles.bannerTitle}>景区 / 校园 双场景入口</div>
          <div style={styles.bannerDesc}>后续所有行中功能都从这里分发</div>
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
        ) : (
          <div style={styles.grid}>
            {scenes.map(scene => (
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
