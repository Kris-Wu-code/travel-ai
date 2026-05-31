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

    if (!supabase) {
      setLoading(false)
      setIsError(true)
      setMessage('系统未配置 Supabase，无法注册')
      return
    }

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
      await (supabase as any).from('profiles').insert({
        user_id: data.user.id,
        display_name: email.split('@')[0],
        questionnaire_done: false,
      })
    }

   setIsError(false)
setMessage('注册成功！请查收邮件完成验证，然后去登录')
  }

  return (
    <div className="auth-shell">
      <aside className="auth-side">
        <div className="brand-badge">TRAVEL AI</div>
        <h1>创建你的旅行账号</h1>
        <p>注册后可保存偏好和问卷结果，推荐将更贴合你的旅行习惯。</p>
        <Link href="/" className="btn btn-ghost">返回首页</Link>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <h2>立即注册</h2>
          <p>使用邮箱快速创建账号</p>

          <div className="auth-field">
            <label>邮箱</label>
            <input
              className="auth-input"
              type="email"
              placeholder="请输入邮箱"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label>密码</label>
            <input
              className="auth-input"
              type="password"
              placeholder="至少 6 位密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {message ? (
            <div className={isError ? 'auth-message error' : 'auth-message success'}>{message}</div>
          ) : null}

          <button
            className="auth-submit"
            style={{ opacity: loading ? 0.7 : 1 }}
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? '注册中...' : '注册'}
          </button>

          <p className="auth-switch">
            已有账号？
            <Link href="/auth/login">去登录</Link>
          </p>
        </div>
      </main>
    </div>
  )
}