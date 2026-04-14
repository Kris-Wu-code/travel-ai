'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import PageShell from '../components/page-shell'
import { formatTransportList, getSceneTypeLabel, type SceneRecord } from '../lib/scenes'

type NavScene = SceneRecord

export default function NavigationPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'shortest' | 'multi' | 'indoor'>('shortest')
  const [scenes, setScenes] = useState<NavScene[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadScenes() {
      setLoading(true)
      setError(null)

      const { data, error: loadError } = await supabase
        .from('scenes')
        .select('id, name, scene_type, city, description, center_lat, center_lng, cover_image_url, available_transports, status')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (loadError) {
        setError(loadError.message)
        setLoading(false)
        return
      }

      const nextScenes = data ?? []
      setScenes(nextScenes)
      setSelectedSceneId(previous => previous || nextScenes[0]?.id || '')
      setLoading(false)
    }

    loadScenes()
  }, [])

  const selectedScene = useMemo(
    () => scenes.find(scene => scene.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId],
  )

  return (
    <PageShell backHref="/dashboard" title="路径导航" subtitle="单点最短路径、多点途经和室内导航的统一入口">
      <div>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>当前场景</div>
          {loading ? (
            <div style={styles.panelText}>正在加载场景列表...</div>
          ) : error ? (
            <div style={styles.panelText}>{error}</div>
          ) : scenes.length === 0 ? (
            <div style={styles.panelText}>还没有可用的 scenes 数据，先去导入场景。</div>
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
                  <div style={styles.sceneMeta}>
                    中心点：
                    {selectedScene.center_lat !== null && selectedScene.center_lng !== null
                      ? `${selectedScene.center_lat}, ${selectedScene.center_lng}`
                      : '未设置'}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div style={styles.segmentRow}>
          <button style={mode === 'shortest' ? styles.segmentActive : styles.segment} onClick={() => setMode('shortest')}>单点最短路径</button>
          <button style={mode === 'multi' ? styles.segmentActive : styles.segment} onClick={() => setMode('multi')}>多点途经路线</button>
          <button style={mode === 'indoor' ? styles.segmentActive : styles.segment} onClick={() => setMode('indoor')}>室内导航</button>
        </div>

        {mode === 'shortest' && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>Dijkstra 最短路径</div>
            <div style={styles.cardText}>后续这里会接起点、终点、交通工具和策略切换。</div>
            <div style={styles.cardText}>当前场景下可直接使用的交通工具：{formatTransportList(selectedScene?.available_transports ?? null)}</div>
            <div style={styles.actionRow}>
              <button style={styles.quickBtn} onClick={() => router.push('/places')}>去查场所</button>
              <button style={styles.quickBtn} onClick={() => router.push('/scenes')}>重新选场景</button>
            </div>
          </div>
        )}

        {mode === 'multi' && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>TSP 多点途经</div>
            <div style={styles.cardText}>后续这里会支持拖拽景点列表、限制 15 个节点并展示规划结果。</div>
            <div style={styles.cardText}>当前场景：{selectedScene?.name ?? '未选择'}</div>
            <div style={styles.actionRow}>
              <button style={styles.quickBtn} onClick={() => router.push('/explore')}>去看景点推荐</button>
              <button style={styles.quickBtn} onClick={() => router.push(selectedSceneId ? `/foods?sceneId=${selectedSceneId}` : '/foods')}>去看美食</button>
            </div>
          </div>
        )}

        {mode === 'indoor' && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>三级室内导航</div>
            <div style={styles.cardText}>后续这里会切换楼层图并展示建筑入口、电梯/楼梯和房间路径。</div>
            <div style={styles.cardText}>室内导航优先用于校园和大型建筑类场景。</div>
            <div style={styles.actionRow}>
              <button style={styles.quickBtn} onClick={() => router.push('/scenes')}>换一个场景</button>
              <button style={styles.quickBtn} onClick={() => router.push('/places')}>查室内场所</button>
            </div>
          </div>
        )}

        <div style={styles.quickLinks}>
          <button style={styles.quickBtn} onClick={() => router.push('/scenes')}>去选场景</button>
          <button style={styles.quickBtn} onClick={() => router.push('/places')}>去查场所</button>
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
  panel: {
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
  actionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '14px',
  },
  quickLinks: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '16px',
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
}
