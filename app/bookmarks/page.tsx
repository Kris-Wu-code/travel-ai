'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageShell from '../components/page-shell'
import { loadUserBookmarks, removeBookmark, type Bookmark } from '../lib/bookmarks'

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    const items = await loadUserBookmarks()
    setBookmarks(items)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleRemove = async (id: string, sceneName: string) => {
    setRemovingId(id)
    const success = await removeBookmark(bookmarks.find(b => b.id === id)?.sceneId || '')
    if (success) {
      setBookmarks(bookmarks.filter(b => b.id !== id))
      setMessage({ type: 'success', text: `已移除收藏"${sceneName}"` })
    } else {
      setMessage({ type: 'error', text: '移除失败，请重试' })
    }
    setRemovingId(null)
    setTimeout(() => setMessage(null), 3000)
  }

  return (
    <PageShell
      backHref="/"
      title="我的收藏"
      subtitle="保存喜爱的景区和玩法"
      contentMaxWidth="860px"
    >
      <div style={styles.wrap}>
        <section style={styles.navPromoCard}>
          <div style={styles.navPromoTag}>站内已接入</div>
          <div style={styles.navPromoBody}>
            <div>
              <h2 style={styles.navPromoTitle}>路径导航已上线</h2>
              <p style={styles.navPromoDesc}>
                现在可以直接在网站端打开地图导航页，支持实时定位、模拟定位、逐步引导、语音播报和路线重算。
              </p>
            </div>
            <div style={styles.navPromoActions}>
              <Link href="/navigation" style={styles.navPromoPrimaryBtn}>
                进入导航页
              </Link>
              <Link href="/" style={styles.navPromoSecondaryBtn}>
                返回首页
              </Link>
            </div>
          </div>
          <div style={styles.navPromoChips}>
            <span style={styles.navPromoChip}>地图优先</span>
            <span style={styles.navPromoChip}>实时定位</span>
            <span style={styles.navPromoChip}>逐步引导</span>
            <span style={styles.navPromoChip}>语音播报</span>
          </div>
        </section>

        {message && (
          <div
            style={{
              ...styles.messageBox,
              background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              borderColor: message.type === 'success' ? '#86efac' : '#fecaca',
              color: message.type === 'success' ? '#166534' : '#991b1b',
            }}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <div style={styles.empty}>加载中...</div>
        ) : bookmarks.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>💔</div>
            <div style={styles.emptyTitle}>还没有收藏任何景区</div>
            <div style={styles.emptyDesc}>
              在景区详情页或搜索结果中点击💚按钮来收藏你喜欢的地方
            </div>
            <Link href="/scenes" style={styles.button}>
              去发现景区 →
            </Link>
          </div>
        ) : (
          <>
            <div style={styles.header}>
              <span style={styles.count}>共 {bookmarks.length} 个收藏</span>
              <button onClick={load} style={styles.refreshBtn}>
                刷新
              </button>
            </div>
            <div style={styles.grid} className="bookmarks-grid">
              {bookmarks.map(bookmark => {
                const img = (bookmark as any).imageUrl || ''
                const desc = (bookmark as any).description || ''
                const isHovered = hoveredId === bookmark.id
                return (
                  <div
                    key={bookmark.id}
                    className="bookmark-card"
                    style={{
                      ...styles.card,
                      transform: isHovered ? 'translateY(-6px) scale(1.01)' : 'none',
                      boxShadow: isHovered ? '0 12px 30px rgba(2,6,23,0.08)' : '0 1px 2px rgba(15,23,42,0.04)'
                    }}
                    onMouseEnter={() => setHoveredId(bookmark.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={styles.thumbWrapper} className="bookmark-thumb-wrapper">
                        <div
                          style={{
                            ...styles.thumb,
                            backgroundImage: img ? `url(${img})` : undefined,
                          }}
                          className="bookmark-thumb"
                        >
                          {!img && <div style={styles.thumbPlaceholder}>景区</div>}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemove(bookmark.id, bookmark.sceneName)}
                        disabled={removingId === bookmark.id}
                        style={styles.removeBtnCircle}
                        className="bookmark-remove"
                        title="取消收藏"
                        aria-label="取消收藏"
                      >
                        {removingId === bookmark.id ? '移除中' : '♥'}
                      </button>
                    </div>

                    <div style={styles.cardName}>{bookmark.sceneName}</div>
                    {desc ? <div style={styles.cardDesc} className="bookmark-desc">{desc}</div> : null}

                    <div style={styles.cardTime}>
                      收藏于 {new Date(bookmark.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                    <Link href={`/scenes?q=${encodeURIComponent(bookmark.sceneName)}`} style={styles.cardBtn}>
                      查看详情 →
                    </Link>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    width: '100%',
  },
  navPromoCard: {
    marginBottom: '18px',
    padding: '18px',
    borderRadius: '18px',
    border: '1px solid #cdebe4',
    background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(15,118,110,0.08))',
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
  },
  navPromoTag: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: '999px',
    background: '#ecfdf5',
    color: '#047857',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    marginBottom: '12px',
  },
  navPromoBody: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  navPromoTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 800,
    color: '#0f172a',
  },
  navPromoDesc: {
    margin: '8px 0 0',
    fontSize: '13px',
    lineHeight: '1.7',
    color: '#475569',
    maxWidth: '640px',
  },
  navPromoActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  navPromoPrimaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    borderRadius: '10px',
    background: '#0f766e',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 700,
    textDecoration: 'none',
  },
  navPromoSecondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 700,
    textDecoration: 'none',
  },
  navPromoChips: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '14px',
  },
  navPromoChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.72)',
    color: '#0f766e',
    fontSize: '12px',
    fontWeight: 700,
    border: '1px solid rgba(15,118,110,0.12)',
  },
  messageBox: {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid',
    marginBottom: '16px',
    fontSize: '13px',
    fontWeight: 500,
  },
  empty: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#6b7280',
  },
  emptyCard: {
    textAlign: 'center',
    padding: '60px 20px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
  },
  emptyDesc: {
    marginTop: '6px',
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: '1.5',
  },
  button: {
    display: 'inline-block',
    marginTop: '16px',
    padding: '10px 16px',
    borderRadius: '8px',
    background: '#10b981',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    textDecoration: 'none',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  count: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
  },
  refreshBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px',
  },
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '12px',
    background: '#fff',
    position: 'relative',
    overflow: 'hidden',
    minHeight: '160px',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  city: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  removeBtn: {
    padding: '4px 8px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '18px',
    opacity: 0.7,
    transition: 'opacity 0.2s',
  },
  removeBtnCircle: {
    width: '38px',
    height: '38px',
    borderRadius: '999px',
    border: 'none',
    background: '#fff',
    boxShadow: '0 4px 12px rgba(2,6,23,0.06)',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#ef4444',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbWrapper: {
    width: '86px',
    height: '86px',
    marginRight: '12px',
    flex: '0 0 86px',
  },
  thumb: {
    width: '86px',
    height: '86px',
    borderRadius: '8px',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0f172a',
    fontWeight: 700,
    fontSize: '13px',
  },
  thumbPlaceholder: {
    opacity: 0.6,
    fontSize: '12px',
  },
  cardDesc: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: '1.4',
    maxHeight: '3.6em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardName: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '4px',
  },
  cardTime: {
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '12px',
  },
  cardBtn: {
    display: 'inline-block',
    fontSize: '13px',
    color: '#10b981',
    fontWeight: 600,
    textDecoration: 'none',
    padding: '4px 0',
  },
}
