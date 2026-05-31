'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useParams, usePathname, useRouter } from 'next/navigation'
import PageShell from '../../components/page-shell'
import LoginPromptModal from '../../components/login-prompt-modal'
import { HuffmanTreeVisualization } from '../../components/HuffmanTreeVisualization'
import buildHuffman from '../../lib/algo/compress/buildHuffman'
import { formatTransportList, getSceneTypeLabel, type SceneRecord } from '../../lib/scenes'

type DiaryDetail = {
  id: string
  user_id: string
  scene_id: string | null
  status: 'draft' | 'published' | 'archived'
  title: string
  content_raw: string | null
  content_compressed: string | null
  compressed_size: number | null
  raw_size: number | null
  compression_algo: string | null
  likes_count: number | null
  ai_summary: string | null
  huffman_layout: any | null
  huffman_code_map: any | null
  location_tag: string | null
  view_count: number
  score: number | null
  hot_score: number
  created_at: string
  profiles: { display_name: string }[] | { display_name: string } | null
  scenes: SceneRecord | SceneRecord[] | null
}

export default function DiaryDetailPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ id: string }>()
  const diaryId = Array.isArray(params.id) ? params.id[0] : params.id
  const [diary, setDiary] = useState<DiaryDetail | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [ratingValue, setRatingValue] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [ratingCount, setRatingCount] = useState(0)
  const [averageRating, setAverageRating] = useState<number | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [savingRating, setSavingRating] = useState(false)
  const [savingBookmark, setSavingBookmark] = useState(false)
  const [deletingDiary, setDeletingDiary] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [aiImagePrompt, setAiImagePrompt] = useState('')
  const [aiImageUrl, setAiImageUrl] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [loginPromptTitle, setLoginPromptTitle] = useState('')
  const [loginPromptDescription, setLoginPromptDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likingAnim, setLikingAnim] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [showTechDetails, setShowTechDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDiary() {
      if (!diaryId) {
        setError('缺少日记 ID')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: loadError } = await supabase
        .from('diaries')
        .select(`
          id, user_id, scene_id, status, title, content_raw, content_compressed,
          compressed_size, raw_size, location_tag,
          compression_algo, huffman_layout, huffman_code_map, likes_count, ai_summary,
          view_count, score, hot_score, created_at,
          scenes ( id, name, scene_type, city, description, center_lat, center_lng, cover_image_url, available_transports, status )
        `)
        .eq('id', diaryId)
        .maybeSingle()

      if (loadError) {
        setError(loadError.message)
        setLoading(false)
        return
      }

      const nextDiary = (data ?? null) as DiaryDetail | null

      if (nextDiary) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .eq('user_id', nextDiary.user_id)
          .maybeSingle()

        if (profileRow) {
          nextDiary.profiles = { display_name: (profileRow as any).display_name ?? '匿名' }
        }

        setAverageRating(nextDiary.score)
      }

      setDiary(nextDiary)
      setLikesCount(nextDiary?.likes_count ?? 0)
      const likeKey = `travel-ai:liked:${diaryId}`
      setLiked(localStorage.getItem(likeKey) === '1')

      // AI summary - show if exists, generate if not
      if (nextDiary?.ai_summary) {
        setAiSummary(nextDiary.ai_summary)
      } else if (nextDiary?.content_raw && (nextDiary?.content_raw.length || 0) > 50) {
        // Auto-generate on first view
        setLoadingSummary(true)
        fetch('/api/diary-summary', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ diary_id: diaryId, title: nextDiary.title, content: nextDiary.content_raw, location: nextDiary.location_tag }),
        }).then(r => r.json()).then(d => {
          if (d.summary) setAiSummary(d.summary)
        }).catch(() => {}).finally(() => setLoadingSummary(false))
      }

      setLoading(false)
    }

    loadDiary()
  }, [diaryId])

  useEffect(() => {
    async function loadActionState() {
      if (!diaryId) {
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setCurrentUserId(null)
        setIsBookmarked(false)
        setRatingValue(0)
        return
      }

      setCurrentUserId(user.id)

      const { data: bookmarkRow } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('target_type', 'diary')
        .eq('target_id', diaryId)
        .maybeSingle()

      setIsBookmarked(Boolean(bookmarkRow))

      const { data: ratingRow } = await supabase
        .from('diary_reviews')
        .select('rating')
        .eq('diary_id', diaryId)
        .eq('user_id', user.id)
        .maybeSingle()

      setRatingValue((ratingRow as any)?.rating ? Number((ratingRow as any).rating) : 0)
    }

    loadActionState()
  }, [diaryId])

  useEffect(() => {
    async function loadRatingSummary() {
      if (!diaryId) {
        return
      }

      const { data, error: ratingError } = await supabase
        .from('diary_reviews')
        .select('rating')
        .eq('diary_id', diaryId)

      if (ratingError) {
        setActionMessage(`评分数据加载失败：${ratingError.message}`)
        return
      }

      const rows = data ?? []
      setRatingCount(rows.length)
      if (rows.length === 0) {
        setAverageRating(null)
        return
      }

      const total = rows.reduce((sum: number, row: any) => sum + Number(row.rating ?? 0), 0)
      const avg = Number((total / rows.length).toFixed(2))
      setAverageRating(avg)
      setDiary(previous => (previous ? { ...previous, score: avg } : previous))
    }

    loadRatingSummary()
  }, [diaryId])

  // Load comments via API (bypasses RLS)
  useEffect(() => {
    if (!diaryId) return
    fetch(`/api/diary-comments?diaryId=${diaryId}`).then(r => r.json()).then(d => {
      if (d.comments) setComments(d.comments)
    }).catch(() => {})
  }, [diaryId])

  async function handleSubmitComment() {
    if (!commentText.trim() || !currentUserId) return
    setSubmittingComment(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setSubmittingComment(false); return }
    try {
      const res = await fetch('/api/diary-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ diary_id: diaryId, content: commentText.trim(), parent_id: replyTo }),
      })
      const d = await res.json()
      if (d.comment) {
        setCommentText(''); setReplyTo(null)
        // Reload comments to get author names
        fetch(`/api/diary-comments?diaryId=${diaryId}`).then(r => r.json()).then(d2 => {
          if (d2.comments) setComments(d2.comments)
        }).catch(() => {})
      }
    } catch {} finally { setSubmittingComment(false) }
  }

  async function handleLike() {
    if (!diaryId) return
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikingAnim(true); setTimeout(() => setLikingAnim(false), 400)
    setLikesCount(prev => nextLiked ? prev + 1 : Math.max(0, prev - 1))
    localStorage.setItem(`travel-ai:liked:${diaryId}`, nextLiked ? '1' : '0')
    try {
      await fetch('/api/diary-likes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diary_id: diaryId, action: nextLiked ? 'like' : 'unlike' }),
      })
    } catch {}
  }

  async function handleDeleteComment(commentId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    const res = await fetch(`/api/diary-comments?id=${commentId}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.ok) setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId))
  }

  const topComments = comments.filter(c => !c.parent_id)
  const replies = (parentId: string) => comments.filter(c => c.parent_id === parentId)

  const authorName = useMemo(() => {
    if (!diary?.profiles) {
      return '匿名'
    }

    if (Array.isArray(diary.profiles)) {
      return diary.profiles[0]?.display_name ?? '匿名'
    }

    return diary.profiles.display_name ?? '匿名'
  }, [diary?.profiles])

  const scene = useMemo(() => {
    if (!diary?.scenes) {
      return null
    }

    return Array.isArray(diary.scenes) ? diary.scenes[0] ?? null : diary.scenes
  }, [diary?.scenes])

  const huffmanLayout = useMemo(() => {
    return diary?.huffman_layout ?? null
  }, [diary?.huffman_layout])

  const huffmanBuild = useMemo(() => {
    if (!diary?.content_raw) return null
    try {
      return buildHuffman(diary.content_raw, 'char')
    } catch {
      return null
    }
  }, [diary?.content_raw])

  const [activeTokenId, setActiveTokenId] = useState<string | null>(null)

  const layoutToShow = useMemo(() => {
    // prefer persisted layout from DB if available
    if ((diary as any)?.huffman_layout) return (diary as any).huffman_layout
    if (huffmanBuild) return huffmanBuild.layout
    return null
  }, [diary, huffmanBuild])

  function formatDate(str: string) {
    return new Date(str).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  function formatSize(bytes: number | null) {
    if (!bytes || bytes <= 0) {
      return '未记录'
    }

    if (bytes < 1024) {
      return `${bytes} B`
    }

    return `${(bytes / 1024).toFixed(1)} KB`
  }

  function formatCompressionRate(rawSize: number | null, compressedSize: number | null) {
    if (!rawSize || !compressedSize || rawSize <= 0) {
      return '未计算'
    }

    const rate = ((rawSize - compressedSize) / rawSize) * 100
    return `${rate.toFixed(1)}%`
  }

  function buildLoginUrl() {
    return `/auth/login?next=${encodeURIComponent(pathname)}`
  }

  function promptLogin(title: string, description: string) {
    setLoginPromptTitle(title)
    setLoginPromptDescription(description)
    setLoginPromptOpen(true)
  }

  async function handleToggleBookmark() {
    if (!diary) {
      return
    }

    if (!currentUserId) {
      promptLogin('登录后可收藏这篇日记', '收藏会同步到你的个人主页，登录后会自动回到当前日记。')
      return
    }

    setSavingBookmark(true)
    setActionMessage(null)

    if (isBookmarked) {
      const { error: deleteError } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', currentUserId)
        .eq('target_type', 'diary')
        .eq('target_id', diary.id)

      setSavingBookmark(false)

      if (deleteError) {
        setActionMessage(`取消收藏失败：${deleteError.message}`)
        return
      }

      setIsBookmarked(false)
      setActionMessage('已取消收藏')
      return
    }

    const { error: insertError } = await (supabase as any)
      .from('bookmarks')
      .upsert(
        {
          user_id: currentUserId,
          target_type: 'diary',
          target_id: diary.id,
        },
        { onConflict: 'user_id,target_type,target_id' },
      )

    setSavingBookmark(false)

    if (insertError) {
      setActionMessage(`收藏失败：${insertError.message}`)
      return
    }

    setIsBookmarked(true)
    setActionMessage('收藏成功')
  }

  async function handleSaveRating() {
    if (!diary) {
      return
    }

    if (!currentUserId) {
      promptLogin('登录后可给这篇日记评分', '评分会参与平均分统计，登录后会自动回到当前日记。')
      return
    }

    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      setActionMessage('请先点击星星选择 1 到 5 分')
      return
    }

    setSavingRating(true)
    setActionMessage(null)

    const { error: updateError } = await (supabase as any)
      .from('diary_reviews')
      .upsert(
        {
          diary_id: diary.id,
          user_id: currentUserId,
          rating: Number(ratingValue.toFixed(2)),
        },
        { onConflict: 'diary_id,user_id' },
      )

    setSavingRating(false)

    if (updateError) {
      setActionMessage(`评分保存失败：${updateError.message}`)
      return
    }

    const { data: rows, error: summaryError } = await supabase
      .from('diary_reviews')
      .select('rating')
      .eq('diary_id', diary.id)

    if (summaryError) {
      setActionMessage(`评分保存成功，但汇总失败：${summaryError.message}`)
      return
    }

    const nextRows = rows ?? []
    setRatingCount(nextRows.length)
      if (nextRows.length > 0) {
        const total = nextRows.reduce((sum: number, row: any) => sum + Number(row.rating ?? 0), 0)
      const avg = Number((total / nextRows.length).toFixed(2))
      setAverageRating(avg)
      setDiary({ ...diary, score: avg })
    } else {
      setAverageRating(null)
    }

    setActionMessage('评分保存成功，已更新实时平均分')
  }

  async function handleArchiveDiary() {
    if (!diary) {
      return
    }

    if (!currentUserId) {
      setActionMessage('请先登录后再归档')
      router.push('/auth/login')
      return
    }

    if (currentUserId !== diary.user_id) {
      setActionMessage('仅作者可归档该日记')
      return
    }

    const diaryTypeText = diary.status === 'published' ? '已发布日记' : '草稿'
    const confirmed = window.confirm(`确认归档这篇${diaryTypeText}吗？归档后可在"已归档"中恢复。`)
    if (!confirmed) {
      return
    }

    setDeletingDiary(true)
    setActionMessage(null)

    const { error: archiveError } = await (supabase as any)
      .from('diaries')
      .update({ status: 'archived' })
      .eq('id', diary.id)
      .eq('user_id', currentUserId)

    setDeletingDiary(false)

    if (archiveError) {
      setActionMessage(`归档失败：${archiveError.message}`)
      return
    }

    setDiary({ ...diary, status: 'archived' })
    setActionMessage('已归档，可在"已归档"中恢复')
  }

  async function handleRestoreDiary() {
    if (!diary) {
      return
    }

    if (!currentUserId) {
      setActionMessage('请先登录后再恢复')
      router.push('/auth/login')
      return
    }

    if (currentUserId !== diary.user_id) {
      setActionMessage('仅作者可恢复该日记')
      return
    }

    const confirmed = window.confirm('确认将该归档日记恢复为草稿吗？')
    if (!confirmed) {
      return
    }

    setDeletingDiary(true)
    setActionMessage(null)

    const { error: restoreError } = await (supabase as any)
      .from('diaries')
      .update({ status: 'draft' })
      .eq('id', diary.id)
      .eq('user_id', currentUserId)

    setDeletingDiary(false)

    if (restoreError) {
      setActionMessage(`恢复失败：${restoreError.message}`)
      return
    }

    setDiary({ ...diary, status: 'draft' })
    setActionMessage('已恢复到草稿箱')
  }

  return (
    <PageShell backHref="/diary" title="日记详情" subtitle="发现精彩旅行故事" contentMaxWidth="860px">
      <div>
        {loading ? (
          <div style={styles.card}>日记数据加载中...</div>
        ) : error ? (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>日记加载失败</div>
            <p style={styles.text}>{error}</p>
          </div>
        ) : diary ? (
          <>
            <div style={styles.hero}>
              <div style={styles.heroTop}>
                <div style={styles.tag}>{diary.location_tag ?? '未设置目的地'}</div>
                <div style={styles.time}>{formatDate(diary.created_at)}</div>
              </div>
              <h2 style={styles.heroTitle}>{diary.title}</h2>
              <div style={styles.heroMeta}>
                <span>作者：{authorName}</span>
                <span>状态：{diary.status === 'draft' ? '草稿' : diary.status === 'published' ? '已发布' : '已归档'}</span>
                <span>浏览：{diary.view_count}</span>
                <button type="button" onClick={handleLike}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', background: liked ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.12)', color: liked ? '#ef4444' : 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: '6px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, transition: 'transform 0.2s', transform: likingAnim ? 'scale(1.2)' : 'scale(1)' }}>
                  {liked ? '❤️' : '🤍'} {likesCount}
                </button>
                {averageRating !== null ? <span>评分：{averageRating}</span> : null}
                <span>评价：{ratingCount} 人</span>
              </div>
            </div>

            {scene ? (
              <div style={styles.card}>
                <div style={styles.sectionTitle}>关联场景</div>
                <p style={styles.text}>
                  {scene.name} · {getSceneTypeLabel(scene.scene_type)} · {scene.city ?? '未填写城市'}
                </p>
                <p style={styles.text}>可用交通：{formatTransportList(scene.available_transports)}</p>
                <button style={styles.linkBtn} onClick={() => router.push(`/scenes/${scene.id}`)}>
                  查看场景详情
                </button>
              </div>
            ) : null}

            {aiSummary ? (
              <div style={styles.card}>
                <div style={styles.sectionTitle}>🤖 AI 摘要</div>
                <p style={styles.aiSummaryText}>{aiSummary}</p>
              </div>
            ) : loadingSummary ? (
              <div style={styles.card}>
                <div style={styles.sectionTitle}>🤖 AI 摘要</div>
                <p style={styles.aiSummaryLoading}>⏳ AI 正在分析这篇游记...</p>
              </div>
            ) : null}

            <div style={styles.card}>
              <div style={styles.sectionTitle}>正文</div>
              <p style={styles.text}>{diary.content_raw ?? '暂无正文内容'}</p>
            </div>

            {/* Tech details - collapsed toggle */}
            <div style={styles.card}>
              <button type="button" onClick={() => setShowTechDetails(!showTechDetails)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                <span style={{ ...styles.sectionTitle, margin: 0 }}>🔧 技术详情</span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{showTechDetails ? '收起 ▲' : '展开 ▼'}</span>
              </button>
              {showTechDetails ? (
                <>
                  <div style={styles.statsGrid}>
                    <div style={styles.statBox}>
                      <div style={styles.statLabel}>原文大小</div>
                      <div style={styles.statValue}>{formatSize(diary.raw_size)}</div>
                    </div>
                    <div style={styles.statBox}>
                      <div style={styles.statLabel}>压缩后大小</div>
                      <div style={styles.statValue}>{formatSize(diary.compressed_size)}</div>
                    </div>
                    <div style={styles.statBox}>
                      <div style={styles.statLabel}>压缩率</div>
                      <div style={styles.statValue}>{formatCompressionRate(diary.raw_size, diary.compressed_size)}</div>
                    </div>
                    <div style={styles.statBox}>
                      <div style={styles.statLabel}>热度分</div>
                      <div style={styles.statValue}>{diary.hot_score.toFixed(2)}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    <HuffmanTreeVisualization
                      layout={layoutToShow ?? huffmanLayout}
                      activeTokenId={activeTokenId}
                      onNodeHover={(id) => setActiveTokenId(id)}
                      title="Huffman 压缩树"
                      subtitle={diary.compression_algo === 'huffman' ? `压缩算法：Huffman · 节省了 ${formatCompressionRate(diary.raw_size, diary.compressed_size)}` : '当前日记未压缩或文本太短'}
                      emptyLabel="无压缩树数据"
                      emptyDescription={diary.compression_algo === 'huffman' ? '树布局数据缺失，请重新编辑并保存日记' : '正文内容较短，未触发 Huffman 压缩'}
                    />
                  </div>
                  {huffmanBuild ? (
                    <div style={{ marginTop: '18px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '8px' }}>原文 / 压缩 对照</div>
                      <p style={styles.text}>
                        校验：{(huffmanBuild.segments.map(s => s.source).join('') === (diary.content_raw ?? '')) ? '已通过' : '不匹配'}
                      </p>
                      <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280' }}>#</th>
                              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280' }}>原文</th>
                              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280' }}>编码</th>
                              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280' }}>比特长度</th>
                              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280' }}>累计比特</th>
                            </tr>
                          </thead>
                          <tbody>
                            {huffmanBuild.segments.slice(0, 200).map(row => (
                              <tr key={row.index}
                                onMouseEnter={() => setActiveTokenId(row.tokenId)}
                                onMouseLeave={() => setActiveTokenId(null)}
                                style={{ background: activeTokenId === row.tokenId ? '#f8fafc' : 'transparent' }}>
                                <td style={{ padding: '6px 8px', borderTop: '1px solid #eef2f7' }}>{row.index + 1}</td>
                                <td style={{ padding: '6px 8px', borderTop: '1px solid #eef2f7' }}>{row.source}</td>
                                <td style={{ padding: '6px 8px', borderTop: '1px solid #eef2f7', fontFamily: 'monospace' }}>{row.code}</td>
                                <td style={{ padding: '6px 8px', borderTop: '1px solid #eef2f7', textAlign: 'right' }}>{row.bitLength}</td>
                                <td style={{ padding: '6px 8px', borderTop: '1px solid #eef2f7', textAlign: 'right' }}>{row.cumulativeBitsAfter}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {huffmanBuild.segments.length > 200 ? (
                          <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>仅展示前 200 条分段。</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            {/* AI 封面图展示 */}
            {aiImagePrompt ? (
              <div style={aiImageUrl ? styles.card : styles.promptCard}>
                <div style={aiImageUrl ? styles.sectionTitle : styles.promptHeader}>
                  🎨 AI 封面图
                  {!aiImageUrl ? <span style={styles.promptBadge}>需要配置图片生成 API Key</span> : null}
                </div>
                {aiImageUrl ? (
                  <img src={aiImageUrl} alt="AI 封面图" style={{ width: '100%', borderRadius: '12px', marginTop: '12px' }} />
                ) : (
                  <>
                    <div style={styles.promptText}>{aiImagePrompt}</div>
                    <button
                      type="button"
                      style={styles.copyBtn}
                      onClick={() => { navigator.clipboard.writeText(aiImagePrompt); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000) }}
                    >
                      {copySuccess ? '✅ 已复制' : '📋 复制提示词'}
                    </button>
                  </>
                )}
              </div>
            ) : null}

            <div style={styles.actions}>
              <button style={styles.primaryBtn} onClick={() => router.push('/diary')}>返回日记列表</button>
              <button style={styles.secondaryBtn} onClick={() => router.push(scene ? `/diary/write?sceneId=${scene.id}` : '/diary/write')}>
                写同场景日记
              </button>
              {currentUserId === diary.user_id && diary.status === 'draft' ? (
                <button
                  style={styles.secondaryBtn}
                  onClick={() => {
                    const editSceneId = diary.scene_id ?? scene?.id ?? ''
                    const query = editSceneId
                      ? `/diary/write?diaryId=${diary.id}&sceneId=${editSceneId}`
                      : `/diary/write?diaryId=${diary.id}`
                    router.push(query)
                  }}
                >
                  继续编辑草稿
                </button>
              ) : null}
              <button style={styles.secondaryBtn} onClick={handleToggleBookmark} disabled={savingBookmark}>
                {savingBookmark ? '处理中...' : isBookmarked ? '取消收藏' : '收藏'}
              </button>
              {currentUserId === diary.user_id && (diary.status === 'draft' || diary.status === 'published') ? (
                <button style={styles.dangerBtn} onClick={handleArchiveDiary} disabled={deletingDiary}>
                  {deletingDiary ? '归档中...' : diary.status === 'published' ? '归档日记' : '归档草稿'}
                </button>
              ) : null}
              {currentUserId === diary.user_id && diary.status === 'archived' ? (
                <button style={styles.restoreBtn} onClick={handleRestoreDiary} disabled={deletingDiary}>
                  {deletingDiary ? '恢复中...' : '恢复草稿'}
                </button>
              ) : null}
              <button
                style={generatingImage ? { ...styles.secondaryBtn, opacity: 0.6 } : styles.secondaryBtn}
                onClick={async () => {
                  if (!diary) return
                  setGeneratingImage(true)
                  setAiImagePrompt('')
                  setAiImageUrl('')
                  try {
                    const res = await fetch('/api/generate-diary-image', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: diary.title,
                        content: diary.content_raw || '',
                        location: diary.location_tag || '',
                      }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    setAiImagePrompt(data.imagePrompt)
                    setAiImageUrl(data.imageDataUrl || '')
                  } catch (err: any) {
                    setActionMessage(err.message || 'AI 图片生成失败')
                  } finally { setGeneratingImage(false) }
                }}
                disabled={generatingImage}
              >
                {generatingImage ? '🎨 AI 生成中...' : '🎨 AI 生成封面图'}
              </button>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionTitle}>评分</div>
              <div style={styles.ratingRow}>
                <div style={styles.starsWrap}>
                  {[1, 2, 3, 4, 5].map(star => {
                    const active = star <= (hoverRating || ratingValue)
                    return (
                      <button
                        key={star}
                        type="button"
                        style={active ? styles.starBtnActive : styles.starBtn}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRatingValue(star)}
                        aria-label={`评分 ${star} 星`}
                      >
                        ★
                      </button>
                    )
                  })}
                </div>
                <span style={styles.ratingHintText}>
                  {ratingValue > 0 ? `已选择 ${ratingValue} 星` : '点击星星评分'}
                </span>
                <button style={styles.secondaryBtn} onClick={handleSaveRating} disabled={savingRating}>
                  {savingRating ? '保存中...' : '保存评分'}
                </button>
              </div>
              <p style={styles.text}>评分采用"一人一评"，可随时更新，提交后会实时刷新平均分与评价人数。</p>
            </div>

            {/* Comments section */}
            <div style={styles.card}>
              <div style={styles.sectionTitle}>评论 ({topComments.length})</div>

              {/* Comment form */}
              <div style={{ marginTop: '12px' }}>
                {replyTo ? (
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    回复 @{comments.find(c => c.id === replyTo)?.author || '...'}
                    <button type="button" onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: '12px' }}>取消</button>
                  </div>
                ) : null}
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder={currentUserId ? '写下你的评论...' : '登录后可评论'}
                  disabled={!currentUserId}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={submittingComment || !commentText.trim() || !currentUserId}
                  style={{
                    marginTop: '8px', padding: '8px 18px', borderRadius: '8px',
                    border: 'none', background: commentText.trim() && currentUserId ? '#4f46e5' : '#e5e7eb',
                    color: commentText.trim() && currentUserId ? '#fff' : '#9ca3af',
                    cursor: commentText.trim() && currentUserId ? 'pointer' : 'not-allowed',
                    fontWeight: 600, fontSize: '13px',
                  }}
                >
                  {submittingComment ? '提交中...' : '发表评论'}
                </button>
              </div>

              {/* Comment list */}
              <div style={{ marginTop: '16px' }}>
                {topComments.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>暂无评论，来抢沙发吧</div>
                ) : (
                  topComments.map(c => (
                    <div key={c.id} style={{ padding: '12px 0', borderTop: '1px solid #f3f4f6' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{c.author}</div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#9ca3af' }}>{new Date(c.created_at).toLocaleDateString('zh-CN')}</span>
                          <button type="button" onClick={() => setReplyTo(c.id)}
                            style={{ border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 500 }}>
                            回复
                          </button>
                          {currentUserId === c.user_id ? (
                            <button type="button" onClick={() => handleDeleteComment(c.id)}
                              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>
                              删除
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.6, marginTop: '4px' }}>{c.content}</div>
                      {/* Replies */}
                      {replies(c.id).map(r => (
                        <div key={r.id} style={{ marginTop: '10px', marginLeft: '24px', padding: '10px', background: '#f9fafb', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{r.author}</span>
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>{new Date(r.created_at).toLocaleDateString('zh-CN')}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px', lineHeight: 1.5 }}>{r.content}</div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>

            {actionMessage ? (
              <div style={styles.toast}>{actionMessage}</div>
            ) : null}

            <LoginPromptModal
              open={loginPromptOpen}
              title={loginPromptTitle}
              description={loginPromptDescription}
              onCancel={() => setLoginPromptOpen(false)}
              onConfirm={() => router.push(buildLoginUrl())}
            />
          </>
        ) : (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>日记不存在</div>
            <p style={styles.text}>这个日记 ID 还没有接入真实数据，后续会从 Supabase diaries 表读取。</p>
          </div>
        )}
      </div>
    </PageShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  hero: {
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    color: '#fff',
    borderRadius: '18px',
    padding: '28px',
    marginBottom: '16px',
  },
  heroTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '10px',
    flexWrap: 'wrap',
  },
  tag: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.18)',
    fontSize: '12px',
  },
  time: {
    fontSize: '13px',
    opacity: 0.85,
  },
  heroTitle: {
    fontSize: '28px',
    fontWeight: 800,
    margin: 0,
  },
  heroMeta: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '10px',
    fontSize: '13px',
    opacity: 0.9,
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '8px',
  },
  text: {
    fontSize: '14px',
    lineHeight: 1.8,
    color: '#4b5563',
    margin: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
    margin: '16px 0',
  },
  statBox: {
    padding: '16px',
    borderRadius: '14px',
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
  },
  statLabel: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '6px',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#111827',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    padding: '12px 18px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  secondaryBtn: {
    padding: '12px 18px',
    background: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  dangerBtn: {
    padding: '10px 14px',
    background: '#fff1f2',
    color: '#b91c1c',
    border: '1px solid #fecdd3',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  restoreBtn: {
    padding: '10px 14px',
    background: '#ecfdf5',
    color: '#065f46',
    border: '1px solid #6ee7b7',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  linkBtn: {
    marginTop: '12px',
    padding: '10px 14px',
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  ratingRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  starsWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  starBtn: {
    border: 'none',
    background: 'transparent',
    color: '#d1d5db',
    fontSize: '24px',
    lineHeight: 1,
    cursor: 'pointer',
    padding: '0 2px',
  },
  starBtnActive: {
    border: 'none',
    background: 'transparent',
    color: '#f59e0b',
    fontSize: '24px',
    lineHeight: 1,
    cursor: 'pointer',
    padding: '0 2px',
  },
  ratingHintText: {
    fontSize: '13px',
    color: '#4b5563',
  },
  aiSummaryText: { fontSize: '15px', lineHeight: 1.8, color: '#4b5563', margin: 0, fontStyle: 'italic' },
  aiSummaryLoading: { fontSize: '14px', color: '#6b7280', margin: 0 },
  toast: {
    marginTop: '4px',
    marginBottom: '12px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    borderRadius: '10px',
    padding: '10px 12px',
    fontSize: '13px',
  },
  promptCard: {
    background: 'linear-gradient(135deg, #1e1b4b, #312e81, #4c1d95)',
    borderRadius: '16px', padding: '24px', marginBottom: '16px', color: '#fff',
  },
  promptHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '14px', flexWrap: 'wrap', gap: '8px',
    fontSize: '16px', fontWeight: 700,
  },
  promptBadge: {
    fontSize: '11px', fontWeight: 500, opacity: 0.7,
    background: 'rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: '999px',
  },
  promptText: {
    fontSize: '14px', lineHeight: 1.7, opacity: 0.92,
    background: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: '10px',
    fontFamily: 'monospace', wordBreak: 'break-all',
  },
  copyBtn: {
    marginTop: '12px', padding: '8px 18px', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)',
    color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
  },
}