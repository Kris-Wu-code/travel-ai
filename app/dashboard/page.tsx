'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

type DashboardProfileRow = {
  display_name: string | null
  preferences: {
    profile_avatar_url?: string
  } | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let isMounted = true

    async function hydrateAccountState(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, preferences')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      const profile = (profileData ?? null) as DashboardProfileRow | null
      const profileAvatar = typeof profile?.preferences?.profile_avatar_url === 'string' ? profile.preferences.profile_avatar_url : ''

      setEmail(user.email ?? '')
      setDisplayName(profile?.display_name ?? (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '') ?? user.email?.split('@')[0] ?? '旅行者')
      setAvatarUrl(profileAvatar || (typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : ''))
      setLoading(false)
    }

    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        if (!isMounted) {
          return
        }

        setIsAuthenticated(false)
        setEmail('')
        setDisplayName('游客')
        setAvatarUrl('')
        setLoading(false)
        return
      }

      if (!isMounted) {
        return
      }

      setIsAuthenticated(true)
      await hydrateAccountState(user)
    }

    checkUser()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        if (isMounted) {
          setIsAuthenticated(false)
          setEmail('')
          setDisplayName('游客')
          setAvatarUrl('')
          setProfileMenuOpen(false)
          setLoading(false)
        }
        return
      }

      if (!isMounted) {
        return
      }

      setIsAuthenticated(true)
      await hydrateAccountState(session.user)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!profileMenuRef.current) {
        return
      }

      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    document.addEventListener('keydown', handleEscapeKey)

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [])

  async function handleLogout() {
    setProfileMenuOpen(false)
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setEmail('')
    setDisplayName('游客')
    setAvatarUrl('')
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center',
        alignItems: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
        加载中...
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f7fa',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* 顶部导航栏 */}
      <div style={{
        background: '#fff',
        padding: '0 32px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <span style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a2e' }}>
          个性化旅游系统
        </span>
        <div ref={profileMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => setProfileMenuOpen(open => !open)}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '6px 10px',
                  borderRadius: '999px',
                  background: '#f8fafc',
                  border: '1px solid #e5e7eb',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="头像"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1px solid #d1d5db',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {(displayName || email || 'T').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{displayName || '个人主页'}</span>
                  <span style={{ fontSize: '12px', color: '#6b7280', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email}
                  </span>
                </div>
                <span style={{ color: '#6b7280', fontSize: '12px' }}>▾</span>
              </button>

              {profileMenuOpen ? (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: '220px',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '14px',
                  boxShadow: '0 16px 32px rgba(15, 23, 42, 0.12)',
                  overflow: 'hidden',
                  zIndex: 20,
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      router.push('/profile')
                    }}
                    style={styles.menuItem}
                  >
                    <span style={styles.menuTitle}>个人主页</span>
                    <span style={styles.menuDesc}>查看偏好、日记与收藏</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      router.push('/profile/edit')
                    }}
                    style={styles.menuItem}
                  >
                    <span style={styles.menuTitle}>设置</span>
                    <span style={styles.menuDesc}>编辑昵称与个人简介</span>
                  </button>
                  <div style={{ height: '1px', background: '#e5e7eb' }} />
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{ ...styles.menuItem, color: '#b91c1c' }}
                  >
                    <span style={styles.menuTitle}>退出登录</span>
                    <span style={styles.menuDesc}>结束当前会话</span>
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button style={styles.loginBtn} onClick={() => router.push('/auth/login')}>登录</button>
              <button style={styles.registerBtn} onClick={() => router.push('/auth/register')}>注册</button>
            </div>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ padding: '40px 32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600',
          color: '#1a1a2e', marginBottom: '8px' }}>
          {isAuthenticated ? '欢迎回来 👋' : '欢迎体验 👋'}
        </h1>
        <p style={{ color: '#888', marginBottom: '32px' }}>
          {isAuthenticated ? '开始规划你的下一次旅行' : '先浏览功能和内容，喜欢后再登录保存'}
        </p>

        {/* 功能入口卡片 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          {[
            { title: '场景选择',    desc: '进入景区或校园',     icon: '🏔️', href: '/scenes'   },
            { title: '路径导航',    desc: '规划最短与最优路线', icon: '🧭', href: '/navigation' },
            { title: '场所查询',    desc: '查看附近设施',       icon: '📍', href: '/places'    },
            { title: '美食推荐',    desc: '探索当地美味',       icon: '🍜', href: '/foods'     },
            { title: 'AI 行程生成', desc: '智能规划专属行程', icon: '✈️', href: '/itinerary' },
            { title: '景点推荐',    desc: '发现热门目的地',   icon: '🗺️', href: '/explore'   },
            { title: '旅游日记',    desc: '记录精彩旅程',     icon: '📔', href: '/diary'     },
            { title: '导入监控',    desc: '查看同步健康度',   icon: '📊', href: '/sync-jobs' },
            { title: '个人主页',    desc: '查看偏好与足迹',     icon: '👤', href: '/profile'   },
          ].map(item => (
            <div key={item.title} style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '24px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              transition: 'transform 0.1s',
            }} onClick={() => router.push(item.href)}  
            >
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>
                {item.icon}
              </div>
              <div style={{ fontSize: '16px', fontWeight: '600',
                color: '#1a1a2e', marginBottom: '4px' }}>
                {item.title}
              </div>
              <div style={{ fontSize: '13px', color: '#888' }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  menuItem: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    textAlign: 'left',
    padding: '12px 14px',
    border: 'none',
    background: '#fff',
    cursor: 'pointer',
  },
  menuTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'inherit',
  },
  menuDesc: {
    fontSize: '12px',
    color: '#6b7280',
  },
  loginBtn: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 600,
  },
  registerBtn: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid #4f46e5',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
}