'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type CityCount = { city: string; count: number }

export default function StatsPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [visitedCities, setVisitedCities] = useState<CityCount[]>([])
  const [wishlistCities, setWishlistCities] = useState<CityCount[]>([])
  const [diaryStats, setDiaryStats] = useState({ published: 0, draft: 0 })
  const [visitCount, setVisitCount] = useState(0)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [totalScenes, setTotalScenes] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const [visits, wishlist, diaries, { count: sceneCount }] = await Promise.all([
        supabase.from('scene_visit_logs').select('scene_id').eq('user_id', user.id),
        supabase.from('bookmarks').select('target_id').eq('user_id', user.id).eq('target_type', 'wishlist'),
        supabase.from('diaries').select('status').eq('user_id', user.id),
        supabase.from('scenes').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ])

      // Get scene cities
      const visitSceneIds = [...new Set((visits.data ?? []).map(v => v.scene_id))]
      const wishSceneIds = [...new Set((wishlist.data ?? []).map(w => w.target_id))]
      const allIds = [...new Set([...visitSceneIds, ...wishSceneIds])]

      if (allIds.length > 0) {
        const { data: scenes } = await supabase.from('scenes').select('id, city').in('id', allIds)
        const cityMap = new Map<string, string>()
        scenes?.forEach(s => { if (s.city) cityMap.set(s.id, s.city) })

        const vCities = new Map<string, number>()
        visitSceneIds.forEach(id => { const c = cityMap.get(id); if (c) vCities.set(c, (vCities.get(c) || 0) + 1) })
        setVisitedCities([...vCities.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count))

        const wCities = new Map<string, number>()
        wishSceneIds.forEach(id => { const c = cityMap.get(id); if (c) wCities.set(c, (wCities.get(c) || 0) + 1) })
        setWishlistCities([...wCities.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count))
      }

      setVisitCount(visitSceneIds.length)
      setWishlistCount(wishSceneIds.length)
      setTotalScenes(sceneCount ?? 0)

      const pub = (diaries.data ?? []).filter(d => d.status === 'published').length
      const draft = (diaries.data ?? []).filter(d => d.status === 'draft').length
      setDiaryStats({ published: pub, draft })

      setLoading(false)
    }
    load()
  }, [])

  const maxCityCount = Math.max(1, ...[...visitedCities, ...wishlistCities].map(c => c.count))

  function CityBar({ city, count, color }: { city: string; count: number; color: string }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ width: '60px', fontSize: '13px', textAlign: 'right', color: '#6b7280', flexShrink: 0 }}>{city}</span>
        <div style={{ flex: 1, height: '22px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(count / maxCityCount) * 100}%`, background: color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ width: '24px', fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>{count}</span>
      </div>
    )
  }

  if (loading) return <div style={shell}><div style={center}>加载中...</div></div>
  if (!userId) return <div style={shell}><div style={center}>请先登录</div></div>

  return (
    <div style={shell}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <a href="/profile" style={{ textDecoration: 'none', color: '#0b8f7a', fontWeight: 700, fontSize: '14px' }}>← 返回个人中心</a>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', margin: '12px 0 4px' }}>旅行统计</h1>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>你的旅行数据一览</p>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: '访问过景区', value: visitCount, icon: '📍' },
            { label: '想去景区', value: wishlistCount, icon: '❤️' },
            { label: '日记', value: diaryStats.published, icon: '📖' },
            { label: '景区总数', value: totalScenes, icon: '🗺️' },
          ].map(s => (
            <div key={s.label} style={statCard}>
              <div style={{ fontSize: '28px', marginBottom: '4px' }}>{s.icon}</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827' }}>{s.value}</div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* City bars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={card}>
            <div style={cardTitle}>📍 已去城市</div>
            {visitedCities.length > 0
              ? visitedCities.slice(0, 12).map(c => <CityBar key={c.city} city={c.city} count={c.count} color="#4f46e5" />)
              : <div style={emptyText}>还没有访问记录</div>}
          </div>
          <div style={card}>
            <div style={cardTitle}>❤️ 想去城市分布</div>
            {wishlistCities.length > 0
              ? wishlistCities.slice(0, 12).map(c => <CityBar key={c.city} city={c.city} count={c.count} color="#f97316" />)
              : <div style={emptyText}>还没有想去标记</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

const shell: React.CSSProperties = {
  minHeight: '100vh', background: 'linear-gradient(180deg, #f7fbfa 0%, #f0f5f4 100%)',
  padding: '24px 32px',
}
const center: React.CSSProperties = { textAlign: 'center', padding: '60px', color: '#9ca3af' }
const statCard: React.CSSProperties = {
  background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
}
const card: React.CSSProperties = {
  background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
}
const cardTitle: React.CSSProperties = { fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px' }
const emptyText: React.CSSProperties = { fontSize: '13px', color: '#9ca3af', padding: '10px 0' }
