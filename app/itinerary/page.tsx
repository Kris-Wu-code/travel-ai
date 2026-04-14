'use client'

import { useRouter } from 'next/navigation'

export default function ItineraryPage() {
  const router = useRouter()

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.back} onClick={() => router.push('/dashboard')}>
          ← 返回
        </button>
        <h1 style={s.title}>AI 行程生成</h1>
      </div>

      <div style={s.content}>
        <div style={s.heroCard}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✈️</div>
          <h2 style={s.heroTitle}>告诉我你想去哪里</h2>
          <p style={s.heroDesc}>
            输入目的地和天数，AI 为你生成专属旅行行程
          </p>
        </div>

        <div style={s.formCard}>
          <div style={s.field}>
            <label style={s.label}>目的地</label>
            <input
              style={s.input}
              placeholder="例如：北京、成都、西藏..."
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>旅行天数</label>
            <input
              style={s.input}
              type="number"
              placeholder="例如：3"
              min={1}
              max={30}
            />
          </div>
          <button style={s.btn}>
            🪄 生成行程（即将上线）
          </button>
          <p style={s.comingSoon}>
            AI 行程生成功能正在开发中，敬请期待
          </p>
        </div>
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
    maxWidth: '560px',
    margin: '0 auto',
    padding: '40px 24px',
  },
  heroCard: {
    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
    borderRadius: '16px',
    padding: '40px',
    textAlign: 'center',
    marginBottom: '24px',
  },
  heroTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#fff',
    margin: '0 0 8px',
  },
  heroDesc: {
    fontSize: '15px',
    color: 'rgba(255,255,255,0.8)',
    margin: 0,
  },
  formCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  field: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  btn: {
    width: '100%',
    padding: '13px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '12px',
  },
  comingSoon: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#9ca3af',
    margin: 0,
  },
}