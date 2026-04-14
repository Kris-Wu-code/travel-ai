'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

type Scene = {
  id: string
  name: string
  scene_type: string
  city: string
  description: string
}

export default function ExplorePage() {
  const router = useRouter()
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadScenes() {
      const { data, error } = await supabase
        .from('scenes')
        .select('id, name, scene_type, city, description')
        .eq('status', 'active')

      if (!error && data) setScenes(data)
      setLoading(false)
    }
    loadScenes()
  }, [])

  const typeLabel = (type: string) =>
    type === 'scenic_spot' ? '🏔️ 景区' : '🎓 校园'

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.back} onClick={() => router.push('/dashboard')}>
          ← 返回
        </button>
        <h1 style={s.title}>景点推荐</h1>
      </div>

      <div style={s.content}>
        <p style={s.subtitle}>发现热门景区和校园，开始你的旅程</p>

        {loading ? (
          <div style={s.empty}>加载中...</div>
        ) : scenes.length === 0 ? (
          <div style={s.emptyCard}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗺️</div>
            <div style={s.emptyTitle}>暂无景点数据</div>
            <div style={s.emptyDesc}>管理员还没有录入景点，敬请期待</div>
          </div>
        ) : (
          <div style={s.grid}>
            {scenes.map(scene => (
              <div key={scene.id} style={s.card}>
                <div style={s.cardTop}>
                  <span style={s.tag}>{typeLabel(scene.scene_type)}</span>
                  <span style={s.city}>{scene.city}</span>
                </div>
                <div style={s.cardName}>{scene.name}</div>
                {scene.description && (
                  <div style={s.cardDesc}>{scene.description}</div>
                )}
                <button style={s.cardBtn}>查看详情 →</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f5f7fa',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    background: '#fff',
    padding: '0 32px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  back: {
    background: 'none',
    border: 'none',
    fontSize: '15px',
    color: '#4f46e5',
    cursor: 'pointer',
    padding: '0',
    fontWeight: '500',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e',
    margin: 0,
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '40px 24px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#6b7280',
    marginBottom: '28px',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tag: {
    fontSize: '12px',
    padding: '3px 10px',
    background: '#eef2ff',
    color: '#4f46e5',
    borderRadius: '20px',
    fontWeight: '500',
  },
  city: {
    fontSize: '13px',
    color: '#9ca3af',
  },
  cardName: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e',
  },
  cardDesc: {
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: '1.5',
    flex: 1,
  },
  cardBtn: {
    background: 'none',
    border: 'none',
    color: '#4f46e5',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    padding: '0',
    textAlign: 'left',
    marginTop: '8px',
  },
}