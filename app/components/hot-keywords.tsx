'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Keyword = { keyword: string; count: number; size: number }

export default function HotKeywords() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const router = useRouter()

  useEffect(() => {
    fetch('/api/hot-keywords').then(r => r.json()).then(d => {
      if (d.keywords) setKeywords(d.keywords)
    }).catch(() => {})
  }, [])

  if (keywords.length === 0) return null

  const colors = ['#4f46e5', '#7c3aed', '#db2777', '#059669', '#d97706', '#2563eb', '#9333ea', '#dc2626']

  return (
    <div style={{
      background: '#fff', borderRadius: '16px', padding: '16px 20px',
      border: '1px solid #e5e7eb', boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      marginBottom: '16px',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>🔥 热门搜索</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        {keywords.map((kw, i) => (
          <button
            key={kw.keyword}
            type="button"
            onClick={() => router.push(`/scenes?q=${encodeURIComponent(kw.keyword)}`)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: kw.size, fontWeight: 600,
              color: colors[i % colors.length],
              opacity: 0.6 + (kw.count / (keywords[0]?.count || 1)) * 0.4,
              padding: '2px 6px', borderRadius: '6px',
              transition: 'opacity 0.2s',
              lineHeight: 1.4,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => { e.currentTarget.style.opacity = String(0.6 + (kw.count / (keywords[0]?.count || 1)) * 0.4) }}
          >
            {kw.keyword}
          </button>
        ))}
      </div>
    </div>
  )
}
