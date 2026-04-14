'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  async function handleRegister() {
    if (!email || !password) {
      setIsError(true)
      setMessage('请填写邮箱和密码')
      return
    }
    if (password.length < 6) {
      setIsError(true)
      setMessage('密码至少需要6位')
      return
    }

    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setIsError(true)
      setMessage('注册失败：' + error.message)
      return
    }

    // 注册成功后在 profiles 表里创建用户信息
    if (data.user) {
      await supabase.from('profiles').insert({
        user_id: data.user.id,
        display_name: email.split('@')[0],
        questionnaire_done: false,
      })
    }

   setIsError(false)
setMessage('注册成功！请查收邮件完成验证，然后去登录')
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>创建账号</h1>
        <p style={styles.subtitle}>个性化旅游系统</p>

        <div style={styles.field}>
          <label style={styles.label}>邮箱</label>
          <input
            style={styles.input}
            type="email"
            placeholder="请输入邮箱"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>密码</label>
          <input
            style={styles.input}
            type="password"
            placeholder="至少6位密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        {message && (
          <div style={{
            ...styles.message,
            background: isError ? '#fff0f0' : '#f0fff4',
            color: isError ? '#c0392b' : '#27ae60',
            border: `1px solid ${isError ? '#ffc0c0' : '#a8e6cf'}`,
          }}>
            {message}
          </div>
        )}

        <button
          style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          onClick={handleRegister}
          disabled={loading}
        >
          {loading ? '注册中...' : '注册'}
        </button>

        <p style={styles.linkText}>
          已有账号？
          <Link href="/auth/login" style={styles.link}>去登录</Link>
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
  message: {
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
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