'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import PageShell from '../../components/page-shell'
import { formatTransportList, getSceneTypeLabel, type SceneRecord } from '../../lib/scenes'

type SceneDetail = SceneRecord & {
  poiCount: number
}

export default function SceneDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const sceneId = Array.isArray(params.id) ? params.id[0] : params.id
  const [scene, setScene] = useState<SceneDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadScene() {
      if (!sceneId) {
        setError('缺少场景 ID')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const [sceneResult, poiResult] = await Promise.all([
        supabase
          .from('scenes')
          .select('id, name, scene_type, city, description, center_lat, center_lng, cover_image_url, available_transports, status')
          .eq('id', sceneId)
          .maybeSingle(),
        supabase
          .from('poi_items')
          .select('id')
          .eq('scene_id', sceneId)
          .eq('status', 'approved'),
      ])

      if (sceneResult.error) {
        setError(sceneResult.error.message)
        setLoading(false)
        return
      }

      if (!sceneResult.data) {
        setScene(null)
        setLoading(false)
        return
      }

      setScene({
        ...sceneResult.data,
        poiCount: poiResult.data?.length ?? 0,
      })

      // Best-effort behavior logging for profile "recent scenes".
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      if (userId) {
        const nowIso = new Date().toISOString()
        const { error: visitLogError } = await supabase
          .from('scene_visit_logs')
          .upsert(
            {
              user_id: userId,
              scene_id: sceneId,
              last_visited_at: nowIso,
            },
            { onConflict: 'user_id,scene_id' },
          )

        if (visitLogError) {
          console.error('scene_visit_logs upsert failed:', visitLogError)
        }
      }

      setLoading(false)
    }

    loadScene()
  }, [sceneId])

  return (
    <PageShell backHref="/scenes" title={scene?.name ?? '场景详情'} subtitle="场景详情 / 地图入口页" contentMaxWidth="860px">
      <div>
        {loading ? (
          <div style={styles.card}>场景数据加载中...</div>
        ) : error ? (
          <div style={styles.card}>
            <div style={styles.cardTitle}>场景加载失败</div>
            <div style={styles.cardText}>{error}</div>
          </div>
        ) : scene ? (
          <>
            <div style={styles.hero}>
              <div style={styles.heroLabel}>{getSceneTypeLabel(scene.scene_type)}</div>
              <div style={styles.heroName}>{scene.name}</div>
              <div style={styles.heroMeta}>{scene.city ?? '未填写城市'}</div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardTitle}>场景说明</div>
              <div style={styles.cardText}>{scene.description ?? '暂无场景说明'}</div>
              <div style={styles.infoRow}>可用交通：{formatTransportList(scene.available_transports)}</div>
              <div style={styles.infoRow}>POI 数量：{scene.poiCount}</div>
              <div style={styles.infoRow}>
                场景中心：
                {scene.center_lat !== null && scene.center_lng !== null
                  ? `${scene.center_lat}, ${scene.center_lng}`
                  : '未设置'}
              </div>
            </div>

            <div style={styles.actions}>
              <button style={styles.actionBtn} onClick={() => router.push('/itinerary')}>去生成行程</button>
              <button style={styles.actionBtn} onClick={() => router.push(`/foods?sceneId=${scene.id}`)}>看美食推荐</button>
              <button style={styles.actionBtn} onClick={() => router.push(`/diary?sceneId=${scene.id}`)}>看日记</button>
              <button style={styles.actionBtn} onClick={() => router.push(`/diary/write?sceneId=${scene.id}`)}>写日记</button>
              <button style={styles.actionBtn} onClick={() => router.push('/explore')}>看景点推荐</button>
            </div>
          </>
        ) : (
          <div style={styles.card}>
            <div style={styles.cardTitle}>场景不存在</div>
            <div style={styles.cardText}>数据库里没有找到这个场景，可能是链接过期或数据尚未导入。</div>
          </div>
        )}
      </div>
    </PageShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  hero: {
    borderRadius: '18px',
    padding: '28px',
    color: '#fff',
    background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)',
    marginBottom: '20px',
  },
  heroLabel: {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    opacity: 0.85,
    marginBottom: '8px',
  },
  heroName: {
    fontSize: '28px',
    fontWeight: '800',
    marginBottom: '6px',
  },
  heroMeta: {
    fontSize: '14px',
    opacity: 0.85,
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
    lineHeight: 1.7,
    color: '#4b5563',
  },
  infoRow: {
    marginTop: '10px',
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#374151',
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
  },
  actionBtn: {
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #dbe2f1',
    background: '#fff',
    color: '#111827',
    cursor: 'pointer',
    fontWeight: 600,
  },
}
