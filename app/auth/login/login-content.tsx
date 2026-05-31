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

    if (!supabase) {
      setLoading(false)
      setMessage('系统未配置 Supabase，无法登录')
      return
    }

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
      if (!profile || !(profile as any).questionnaire_done) {
        router.push('/onboarding')
      } else {
        router.push('/')
      }
    } else {
      router.push('/')
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-side">
        <div className="brand-badge">TRAVEL AI</div>
        <h1>欢迎回来</h1>
        <p>登录后继续使用统一工作台，管理你的偏好、景区与旅行计划。</p>
        <Link href="/" className="btn btn-ghost">返回首页</Link>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <h2>登录账号</h2>
          <p>输入邮箱和密码进入工作台</p>

          <div className="auth-field">
            <label>邮箱</label>
            <input
              className="auth-input"
              type="email"
              placeholder="请输入邮箱"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div className="auth-field">
            <label>密码</label>
            <input
              className="auth-input"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {message ? (
            <div className="auth-message error">{message}</div>
          ) : null}

          <button
            className="auth-submit"
            style={{ opacity: loading ? 0.7 : 1 }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>

          <p className="auth-switch">
            没有账号？
            <Link href="/auth/register">去注册</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
