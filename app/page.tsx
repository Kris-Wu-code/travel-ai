import Link from 'next/link'

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{
        fontSize: '42px',
        fontWeight: '700',
        color: '#fff',
        marginBottom: '12px',
      }}>
        个性化旅游系统
      </h1>
      <p style={{
        fontSize: '18px',
        color: 'rgba(255,255,255,0.8)',
        marginBottom: '48px',
      }}>
        AI 驱动，为你规划专属旅程
      </p>
      <div style={{ display: 'flex', gap: '16px' }}>
        <Link href="/auth/register" style={{
          padding: '14px 32px',
          background: '#fff',
          color: '#4f46e5',
          borderRadius: '10px',
          textDecoration: 'none',
          fontSize: '16px',
          fontWeight: '600',
        }}>
          立即注册
        </Link>
        <Link href="/auth/login" style={{
          padding: '14px 32px',
          background: 'rgba(255,255,255,0.2)',
          color: '#fff',
          borderRadius: '10px',
          textDecoration: 'none',
          fontSize: '16px',
          fontWeight: '600',
          border: '1px solid rgba(255,255,255,0.4)',
        }}>
          登录
        </Link>
      </div>
    </div>
  )
}