'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useParams, usePathname, useRouter } from 'next/navigation'
import PageShell from '../../components/page-shell'
import LoginPromptModal from '../../components/login-prompt-modal'
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
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [loginPromptTitle, setLoginPromptTitle] = useState('')
  const [loginPromptDescription, setLoginPromptDescription] = useState('')
  const [loading, setLoading] = useState(true)
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
          nextDiary.profiles = { display_name: profileRow.display_name ?? '匿名' }
        }

        setAverageRating(nextDiary.score)
      }

      setDiary(nextDiary)
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

      setRatingValue(ratingRow?.rating ? Number(ratingRow.rating) : 0)
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

      const total = rows.reduce((sum, row) => sum + Number(row.rating ?? 0), 0)
      const avg = Number((total / rows.length).toFixed(2))
      setAverageRating(avg)
      setDiary(previous => (previous ? { ...previous, score: avg } : previous))
    }

    loadRatingSummary()
  }, [diaryId])

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

    const { error: insertError } = await supabase
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

    const { error: updateError } = await supabase
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
      const total = nextRows.reduce((sum, row) => sum + Number(row.rating ?? 0), 0)
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
    const confirmed = window.confirm(`确认归档这篇${diaryTypeText}吗？归档后可在“已归档”中恢复。`)
    if (!confirmed) {
      return
    }

    setDeletingDiary(true)
    setActionMessage(null)

    const { error: archiveError } = await supabase
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
    setActionMessage('已归档，可在“已归档”中恢复')
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

    const { error: restoreError } = await supabase
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

            <div style={styles.card}>
              <div style={styles.sectionTitle}>正文</div>
              <p style={styles.text}>{diary.content_raw ?? '暂无正文内容'}</p>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionTitle}>压缩统计</div>
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
              <p style={styles.text}>后续这里会补 Huffman 算法细节、压缩树可视化和原文/压缩文对照。</p>
            </div>

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
              <button style={styles.secondaryBtn}>生成 AIGC 动画</button>
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
              <p style={styles.text}>评分采用“一人一评”，可随时更新，提交后会实时刷新平均分与评价人数。</p>
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
}