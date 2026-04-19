'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const nextPath = searchParams.get('next') ?? ''

  async function handleLogin() {
    if (!email || !password) {
      setMessage('请填写邮箱和密码')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setMessage('登录失败：' + error.message)
      return
    }
    if (nextPath) {
      router.push(nextPath)
      return
    }

    // 登录成功后，检查是否完成过问卷
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('questionnaire_done')
        .eq('user_id', user.id)
        .single()

      // 没有 profile 记录，或者问卷未完成，跳到问卷页
      if (!profile || !profile.questionnaire_done) {
        router.push('/onboarding')
      } else {
        router.push('/dashboard')
      }
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>登录</h1>
        <p style={styles.subtitle}>个性化旅游系统</p>

        <div style={styles.field}>
          <label style={styles.label}>邮箱</label>
          <input
            style={styles.input}
            type="email"
            placeholder="请输入邮箱"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>密码</label>
          <input
            style={styles.input}
            type="password"
            placeholder="请输入密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {message && (
          <div style={styles.error}>{message}</div>
        )}

        <button
          style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? '登录中...' : '登录'}
        </button>

        <p style={styles.linkText}>
          没有账号？
          <Link href="/auth/register" style={styles.link}>去注册</Link>
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f7fa',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: '26px',
    fontWeight: '600',
    margin: '0 0 6px',
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: '14px',
    color: '#888',
    margin: '0 0 32px',
  },
  field: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#444',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  error: {
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
    background: '#fff0f0',
    color: '#c0392b',
    border: '1px solid #ffc0c0',
  },
  button: {
    width: '100%',
    padding: '13px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '20px',
  },
  linkText: {
    textAlign: 'center',
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  link: {
    color: '#4f46e5',
    marginLeft: '4px',
    textDecoration: 'none',
    fontWeight: '500',
  },
}
