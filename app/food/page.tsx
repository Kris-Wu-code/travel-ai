'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

type Food = {
  id: string
  name: string
  cuisine_type: string
  canteen_name: string
  window_name: string
  price_range: string
  avg_rating: number
  hot_score: number
}

export default function FoodPage() {
  const router = useRouter()
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('全部')

  const cuisines = ['全部', '川菜', '粤菜', '快餐', '清真', '日料']

  useEffect(() => {
    async function loadFoods() {
      let query = supabase
        .from('food_items')
        .select('id, name, cuisine_type, canteen_name, window_name, price_range, avg_rating, hot_score')
        .eq('status', 'approved')
        .order('hot_score', { ascending: false })
        .limit(20)

      if (filter !== '全部') {
        query = query.eq('cuisine_type', filter)
      }

      const { data, error } = await query
      if (!error && data) setFoods(data)
      setLoading(false)
    }
    loadFoods()
  }, [filter])

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.back} onClick={() => router.push('/dashboard')}>
          ← 返回
        </button>
        <h1 style={s.title}>美食推荐</h1>
      </div>

      <div style={s.content}>
        {/* 菜系筛选 */}
        <div style={s.filterRow}>
          {cuisines.map(c => (
            <button
              key={c}
              style={{
                ...s.filterBtn,
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
          <div style={s.empty}>加载中...</div>
        ) : foods.length === 0 ? (
          <div style={s.emptyCard}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🍜</div>
            <div style={s.emptyTitle}>暂无美食数据</div>
            <div style={s.emptyDesc}>管理员还没有录入美食，敬请期待</div>
          </div>
        ) : (
          <div style={s.grid}>
            {foods.map(food => (
              <div key={food.id} style={s.card}>
                <div style={s.cardHeader}>
                  <span style={s.foodName}>{food.name}</span>
                  {food.cuisine_type && (
                    <span style={s.tag}>{food.cuisine_type}</span>
                  )}
                </div>
                {food.canteen_name && (
                  <div style={s.location}>
                    🏢 {food.canteen_name}
                    {food.window_name && ` · ${food.window_name}`}
                  </div>
                )}
                <div style={s.cardFooter}>
                  {food.price_range && (
                    <span style={s.price}>💴 {food.price_range}元</span>
                  )}
                  {food.avg_rating && (
                    <span style={s.rating}>⭐ {food.avg_rating}</span>
                  )}
                </div>
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
  filterRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '28px',
    flexWrap: 'wrap',
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