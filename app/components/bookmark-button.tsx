'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type BookmarkButtonProps = {
  sceneId: string
  sceneName: string
  city?: string | null
  size?: 'small' | 'large'
}

export default function BookmarkButton({
  sceneId,
  sceneName,
  city,
  size = 'small',
}: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Check initial state
  useEffect(() => {
    checkBookmark()
  }, [sceneId])

  const checkBookmark = async () => {
    try {
      if (!supabase) return
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sceneId,
          sceneName,
          action: 'check',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setIsBookmarked(data.isBookmarked)
      }
    } catch (e) {
      console.error('Failed to check bookmark:', e)
    }
  }

  const handleToggle = async () => {
    setLoading(true)

    try {
      if (!supabase) {
        setMessage('系统未配置 Supabase，无法操作')
        setLoading(false)
        return
      }
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setMessage('请先登录')
        setLoading(false)
        return
      }

      const action = isBookmarked ? 'remove' : 'add'
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sceneId,
          sceneName,
          city,
          action,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setIsBookmarked(data.isBookmarked)
        setMessage(data.isBookmarked ? '已收藏 ✓' : '已取消收藏')
        setTimeout(() => setMessage(null), 2000)
      } else {
        setMessage('操作失败')
      }
    } catch (e) {
      setMessage('操作失败，请重试')
      console.error('Failed to toggle bookmark:', e)
    } finally {
      setLoading(false)
    }
  }

  if (size === 'small') {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '18px',
          opacity: isBookmarked ? 1 : 0.5,
          transition: 'opacity 0.2s',
          padding: 0,
        }}
        title={isBookmarked ? '取消收藏' : '收藏'}
      >
        {isBookmarked ? '💚' : '🤍'}
      </button>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleToggle}
        disabled={loading}
        style={{
          padding: '8px 14px',
          borderRadius: '8px',
          border: isBookmarked ? 'none' : '1px solid #d1d5db',
          background: isBookmarked ? '#10b981' : '#fff',
          color: isBookmarked ? '#fff' : '#374151',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>{isBookmarked ? '💚' : '🤍'}</span>
        <span>{isBookmarked ? '已收藏' : '收藏'}</span>
      </button>
      {message && (
        <div
          style={{
            position: 'absolute',
            top: '-24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#111827',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            zIndex: 100,
          }}
        >
          {message}
        </div>
      )}
    </div>
  )
}
