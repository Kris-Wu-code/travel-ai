'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import PageShell from '../components/page-shell'
import LoginPromptModal from '../components/login-prompt-modal'
import { formatTransportList, getSceneTypeLabel, type SceneRecord } from '../lib/scenes'

const PUBLISHED_PAGE_SIZE = 10
type PublishedSortMode = 'hot' | 'time' | 'rating'

type Diary = {
  id: string
  user_id: string
  title: string
  location_tag: string
  content_raw: string | null
  view_count: number
  score: number | null
  hot_score: number
  created_at: string
  scene_id: string | null
  status: 'draft' | 'published' | 'archived'
  profiles: { display_name: string }[] | { display_name: string } | null
}

type DiaryRatingSummary = {
  averageRating: number | null
  ratingCount: number
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function DiaryPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sceneIdFromUrl = searchParams.get('sceneId') ?? ''
  const [diaries, setDiaries] = useState<Diary[]>([])
  const [scenes, setScenes] = useState<SceneRecord[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'published' | 'draft' | 'archived'>('published')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPublished, setTotalPublished] = useState(0)
  const [sortMode, setSortMode] = useState<PublishedSortMode>('hot')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({})
  const [ratingSummaries, setRatingSummaries] = useState<Record<string, DiaryRatingSummary>>({})
  const [bookmarkedDiaryIds, setBookmarkedDiaryIds] = useState<Set<string>>(new Set())
  const [bookmarkingDiaryId, setBookmarkingDiaryId] = useState<string | null>(null)
  const [hoveredBookmarkDiaryId, setHoveredBookmarkDiaryId] = useState<string | null>(null)
  const [animatedBookmarkDiaryId, setAnimatedBookmarkDiaryId] = useState<string | null>(null)
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [loginPromptTitle, setLoginPromptTitle] = useState('')
  const [loginPromptDescription, setLoginPromptDescription] = useState('')
  const [loginNextUrl, setLoginNextUrl] = useState('')
  const [restoringDiaryId, setRestoringDiaryId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingScenes, setLoadingScenes] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadScenes() {
      setLoadingScenes(true)

      const { data, error: loadError } = await supabase
        .from('scenes')
        .select('id, name, scene_type, city, description, center_lat, center_lng, cover_image_url, available_transports, status')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (loadError) {
        setError(loadError.message)
        setLoadingScenes(false)
        return
      }

      const nextScenes = data ?? []
      setScenes(nextScenes)
      setLoadingScenes(false)
    }

    loadScenes()
  }, [])

  useEffect(() => {
    setSelectedSceneId(sceneIdFromUrl)
  }, [sceneIdFromUrl])

  useEffect(() => {
    async function loadCurrentUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setCurrentUserId(user?.id ?? null)
    }

    loadCurrentUser()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedSceneId, viewMode, sortMode, debouncedSearchTerm])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    async function loadDiaries() {
      setLoading(true)
      setError(null)
      setActionMessage(null)

      let query = supabase
        .from('diaries')
        .select(`
          id, user_id, title, location_tag, content_raw, status,
          view_count, score, hot_score, created_at,
          scene_id
        `)
        .limit(20)

      const normalizedSearchTerm = debouncedSearchTerm.replace(/[,_]/g, ' ').replace(/\s+/g, ' ').trim()
      const hasSearchTerm = viewMode === 'published' && normalizedSearchTerm.length > 0
      const searchPattern = `%${normalizedSearchTerm}%`

      if (viewMode === 'draft' || viewMode === 'archived') {
        if (!currentUserId) {
          setDiaries([])
          setTotalPublished(0)
          setLoading(false)
          return
        }

        query = query
          .eq('user_id', currentUserId)
          .eq('status', viewMode)
          .order('created_at', { ascending: false })
      } else {
        let countQuery = supabase
          .from('diaries')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'published')

        if (hasSearchTerm) {
          countQuery = countQuery.or(
            `title.ilike.${searchPattern},location_tag.ilike.${searchPattern},content_raw.ilike.${searchPattern}`,
          )
        }

        if (selectedSceneId) {
          countQuery = countQuery.eq('scene_id', selectedSceneId)
        }

        const { count, error: countError } = await countQuery
        if (countError) {
          setError(countError.message)
          setDiaries([])
          setTotalPublished(0)
          setLoading(false)
          return
        }

        const total = count ?? 0
        setTotalPublished(total)

        const totalPages = Math.max(1, Math.ceil(total / PUBLISHED_PAGE_SIZE))
        const page = Math.min(currentPage, totalPages)

        query = query.eq('status', 'published')

        if (hasSearchTerm) {
          query = query.or(
            `title.ilike.${searchPattern},location_tag.ilike.${searchPattern},content_raw.ilike.${searchPattern}`,
          )
        }

        if (sortMode === 'time') {
          query = query.order('created_at', { ascending: false })
        } else if (sortMode === 'rating') {
          query = query.order('score', { ascending: false, nullsFirst: false })
        } else {
          query = query.order('hot_score', { ascending: false })
        }

        query = query
          .order('created_at', { ascending: false })
          .range((page - 1) * PUBLISHED_PAGE_SIZE, page * PUBLISHED_PAGE_SIZE - 1)
      }

      if (selectedSceneId) {
        query = query.eq('scene_id', selectedSceneId)
      }

      const { data, error } = await query

      if (error) {
        setError(error.message)
      }

      if (!error && data) {
        const nextDiaries = data as Diary[]
        setDiaries(nextDiaries)

        const userIds = Array.from(new Set(nextDiaries.map(diary => diary.user_id).filter(Boolean)))
        if (userIds.length > 0) {
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', userIds)

          const nextAuthorNames: Record<string, string> = {}
          for (const row of profileRows ?? []) {
            nextAuthorNames[row.user_id] = row.display_name ?? '匿名'
          }
          setAuthorNames(nextAuthorNames)
        } else {
          setAuthorNames({})
        }

        const diaryIds = nextDiaries.map(diary => diary.id)
        if (viewMode === 'published' && diaryIds.length > 0) {
          const { data: reviewRows, error: reviewError } = await supabase
            .from('diary_reviews')
            .select('diary_id, rating')
            .in('diary_id', diaryIds)

          if (reviewError) {
            setError(reviewError.message)
          } else {
            const grouped: Record<string, DiaryRatingSummary> = {}

            for (const diaryId of diaryIds) {
              grouped[diaryId] = { averageRating: null, ratingCount: 0 }
            }

            const rowsByDiary: Record<string, number[]> = {}
            for (const row of reviewRows ?? []) {
              if (!rowsByDiary[row.diary_id]) {
                rowsByDiary[row.diary_id] = []
              }

              rowsByDiary[row.diary_id].push(Number(row.rating ?? 0))
            }

            for (const [diaryId, ratings] of Object.entries(rowsByDiary)) {
              if (ratings.length === 0) {
                continue
              }

              const total = ratings.reduce((sum, rating) => sum + rating, 0)
              grouped[diaryId] = {
                averageRating: Number((total / ratings.length).toFixed(2)),
                ratingCount: ratings.length,
              }
            }

            setRatingSummaries(grouped)
          }
        } else {
          setRatingSummaries({})
        }
      }
      setLoading(false)
    }

    loadDiaries()
  }, [selectedSceneId, viewMode, currentUserId, currentPage, sortMode, debouncedSearchTerm])

  const selectedScene = useMemo(
    () => scenes.find(scene => scene.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId],
  )

  function handleSceneChange(nextSceneId: string) {
    setSelectedSceneId(nextSceneId)
    setDebouncedSearchTerm(searchTerm.trim())

    if (nextSceneId) {
      router.replace(`${pathname}?sceneId=${encodeURIComponent(nextSceneId)}`)
      return
    }

    router.replace(pathname)
  }

  function formatDate(str: string) {
    return new Date(str).toLocaleDateString('zh-CN', {
      month: 'long', day: 'numeric'
    })
  }

  function getAuthorName(diary: Diary) {
    return authorNames[diary.user_id] ?? '匿名'
  }

  function comparePublishedDiaries(left: Diary, right: Diary) {
    if (sortMode === 'time') {
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    }

    if (sortMode === 'rating') {
      const leftScore = left.score ?? -1
      const rightScore = right.score ?? -1
      if (rightScore !== leftScore) {
        return rightScore - leftScore
      }
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    }

    if (right.hot_score !== left.hot_score) {
      return right.hot_score - left.hot_score
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  }

  const totalPublishedPages = Math.max(1, Math.ceil(totalPublished / PUBLISHED_PAGE_SIZE))

  const searchKeywords = useMemo(
    () => debouncedSearchTerm.split(' ').map(item => item.trim()).filter(Boolean),
    [debouncedSearchTerm],
  )

  function countKeywordHits(text: string | null | undefined, keyword: string) {
    if (!text || !keyword) {
      return 0
    }

    const source = text.toLowerCase()
    const needle = keyword.toLowerCase()
    let count = 0
    let index = 0

    while (index !== -1) {
      index = source.indexOf(needle, index)
      if (index !== -1) {
        count += 1
        index += needle.length
      }
    }

    return count
  }

  function getTotalKeywordHits(diary: Diary) {
    if (searchKeywords.length === 0) {
      return 0
    }

    return searchKeywords.reduce(
      (sum, keyword) =>
        sum +
        countKeywordHits(diary.title, keyword) +
        countKeywordHits(diary.location_tag, keyword) +
        countKeywordHits(diary.content_raw, keyword),
      0,
    )
  }

  function renderHighlightedText(text: string, keywords: string[]) {
    if (!text || keywords.length === 0) {
      return text
    }

    const escapedKeywords = keywords
      .map(keyword => keyword.trim())
      .filter(Boolean)
      .map(escapeRegExp)

    if (escapedKeywords.length === 0) {
      return text
    }

    const keywordSet = new Set(keywords.map(keyword => keyword.toLowerCase()))
    const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'ig')
    const parts = text.split(regex)

    return parts.map((part, index) => {
      if (keywordSet.has(part.toLowerCase())) {
        return (
          <mark key={`${part}-${index}`} style={s.highlightMark}>
            {part}
          </mark>
        )
      }

      return <span key={`${part}-${index}`}>{part}</span>
    })
  }

  function buildContentSnippet(content: string | null) {
    if (!content) {
      return ''
    }

    const normalized = content.replace(/\s+/g, ' ').trim()
    if (!normalized) {
      return ''
    }

    if (searchKeywords.length === 0) {
      return normalized.slice(0, 80)
    }

    const lower = normalized.toLowerCase()
    let firstMatchIndex = -1
    for (const keyword of searchKeywords) {
      const idx = lower.indexOf(keyword.toLowerCase())
      if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
        firstMatchIndex = idx
      }
    }

    if (firstMatchIndex === -1) {
      return normalized.slice(0, 80)
    }

    const start = Math.max(0, firstMatchIndex - 18)
    const end = Math.min(normalized.length, firstMatchIndex + 72)
    const prefix = start > 0 ? '...' : ''
    const suffix = end < normalized.length ? '...' : ''

    return `${prefix}${normalized.slice(start, end)}${suffix}`
  }

  const visibleDiaries = useMemo(() => {
    if (viewMode !== 'published') {
      return diaries
    }

    const normalizedSearchTerm = debouncedSearchTerm.replace(/[,_]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!normalizedSearchTerm) {
      return diaries
    }

    const keywords = normalizedSearchTerm.split(' ').filter(Boolean)

    return [...diaries].sort((left, right) => {
      const leftHits = keywords.reduce(
        (sum, keyword) =>
          sum +
          countKeywordHits(left.title, keyword) +
          countKeywordHits(left.location_tag, keyword) +
          countKeywordHits(left.content_raw, keyword),
        0,
      )
      const rightHits = keywords.reduce(
        (sum, keyword) =>
          sum +
          countKeywordHits(right.title, keyword) +
          countKeywordHits(right.location_tag, keyword) +
          countKeywordHits(right.content_raw, keyword),
        0,
      )

      if (rightHits !== leftHits) {
        return rightHits - leftHits
      }

      return comparePublishedDiaries(left, right)
    })
  }, [debouncedSearchTerm, diaries, sortMode, viewMode])

  async function handleRestoreDiary(diaryId: string) {
    if (!currentUserId) {
      setActionMessage('请先登录后再恢复归档日记')
      router.push('/auth/login')
      return
    }

    const confirmed = window.confirm('确认将这篇归档日记恢复为草稿吗？')
    if (!confirmed) {
      return
    }

    setRestoringDiaryId(diaryId)
    setActionMessage(null)

    const { error: restoreError } = await supabase
      .from('diaries')
      .update({ status: 'draft' })
      .eq('id', diaryId)
      .eq('user_id', currentUserId)

    setRestoringDiaryId(null)

    if (restoreError) {
      setActionMessage(`恢复失败：${restoreError.message}`)
      return
    }

    setDiaries(previous => previous.filter(diary => diary.id !== diaryId))
    setActionMessage('已恢复到草稿箱')
  }

  useEffect(() => {
    async function loadBookmarkState() {
      if (!currentUserId || diaries.length === 0 || viewMode !== 'published') {
        setBookmarkedDiaryIds(new Set())
        return
      }

      const diaryIds = diaries.map(diary => diary.id)
      const { data, error: bookmarkError } = await supabase
        .from('bookmarks')
        .select('target_id')
        .eq('user_id', currentUserId)
        .eq('target_type', 'diary')
        .in('target_id', diaryIds)

      if (bookmarkError) {
        setActionMessage(`收藏状态加载失败：${bookmarkError.message}`)
        setBookmarkedDiaryIds(new Set())
        return
      }

      setBookmarkedDiaryIds(new Set((data ?? []).map(row => row.target_id)))
    }

    loadBookmarkState()
  }, [currentUserId, diaries, viewMode])

  async function handleToggleBookmark(diaryId: string) {
    if (!currentUserId) {
      const nextUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
      setLoginPromptTitle('登录后可收藏这篇日记')
      setLoginPromptDescription('收藏会同步到你的个人主页，登录后会自动回到当前列表。')
      setLoginPromptOpen(true)
      setLoginNextUrl(`/auth/login?next=${encodeURIComponent(nextUrl)}`)
      setActionMessage('登录后可继续收藏当前列表中的日记')
      return
    }

    setBookmarkingDiaryId(diaryId)
    setActionMessage(null)

    const alreadyBookmarked = bookmarkedDiaryIds.has(diaryId)
    if (alreadyBookmarked) {
      const { error: deleteError } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', currentUserId)
        .eq('target_type', 'diary')
        .eq('target_id', diaryId)

      setBookmarkingDiaryId(null)

      if (deleteError) {
        setActionMessage(`取消收藏失败：${deleteError.message}`)
        return
      }

      setBookmarkedDiaryIds(previous => {
        const next = new Set(previous)
        next.delete(diaryId)
        return next
      })
      setActionMessage('已取消收藏')
      return
    }

    const { error: insertError } = await supabase
      .from('bookmarks')
      .upsert(
        {
          user_id: currentUserId,
          target_type: 'diary',
          target_id: diaryId,
        },
        { onConflict: 'user_id,target_type,target_id' },
      )

    setBookmarkingDiaryId(null)

    if (insertError) {
      setActionMessage(`收藏失败：${insertError.message}`)
      return
    }

    setBookmarkedDiaryIds(previous => {
      const next = new Set(previous)
      next.add(diaryId)
      return next
    })
    setAnimatedBookmarkDiaryId(diaryId)
    window.setTimeout(() => {
      setAnimatedBookmarkDiaryId(previous => (previous === diaryId ? null : previous))
    }, 260)
    setActionMessage('收藏成功')
  }

  return (
    <PageShell
      backHref="/dashboard"
      title="旅游日记"
      subtitle="发现精彩旅行故事"
      actions={(
        <button
          style={s.writeBtn}
          onClick={() => router.push(selectedSceneId ? `/diary/write?sceneId=${selectedSceneId}` : '/diary/write')}
        >
          + 写日记
        </button>
      )}
      contentMaxWidth="720px"
    >
      <div>
        <div style={s.scenePanel}>
          <div style={s.panelTitle}>当前场景</div>
          {loadingScenes ? (
            <div style={s.panelText}>正在加载场景...</div>
          ) : error ? (
            <div style={s.panelText}>{error}</div>
          ) : scenes.length === 0 ? (
            <div style={s.panelText}>还没有可用的场景数据，请先导入 scenes。</div>
          ) : (
            <>
              <select
                style={s.sceneSelect}
                value={selectedSceneId}
                onChange={event => handleSceneChange(event.target.value)}
              >
                <option value="">全部场景</option>
                {scenes.map(scene => (
                  <option key={scene.id} value={scene.id}>
                    {scene.name}
                  </option>
                ))}
              </select>

              {selectedScene ? (
                <div style={s.sceneSummary}>
                  <div style={s.sceneName}>{selectedScene.name}</div>
                  <div style={s.sceneMeta}>
                    {getSceneTypeLabel(selectedScene.scene_type)} · {selectedScene.city ?? '未填写城市'}
                  </div>
                  <div style={s.sceneMeta}>可用交通：{formatTransportList(selectedScene.available_transports)}</div>
                </div>
              ) : (
                <div style={s.sceneMeta}>当前展示全部公开日记。</div>
              )}
            </>
          )}
        </div>

        <div style={s.modeRow}>
          <button
            style={viewMode === 'published' ? s.modeBtnActive : s.modeBtn}
            onClick={() => setViewMode('published')}
          >
            公开日记
          </button>
          <button
            style={viewMode === 'draft' ? s.modeBtnActive : s.modeBtn}
            onClick={() => setViewMode('draft')}
          >
            我的草稿
          </button>
          <button
            style={viewMode === 'archived' ? s.modeBtnActive : s.modeBtn}
            onClick={() => setViewMode('archived')}
          >
            已归档
          </button>
        </div>

        {viewMode === 'published' ? (
          <div style={s.toolbarRow}>
            <div style={s.searchBox}>
              <label style={s.searchLabel} htmlFor="diary-search-input">
                搜索
              </label>
              <div style={s.searchInputRow}>
                <input
                  id="diary-search-input"
                  style={s.searchInput}
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="标题、目的地或正文关键词"
                />
                <button
                  style={s.searchBtn}
                  onClick={() => setDebouncedSearchTerm(searchTerm.trim())}
                >
                  搜索
                </button>
              </div>
              {searchTerm ? (
                <button
                  style={s.clearSearchBtn}
                  onClick={() => {
                    setSearchTerm('')
                    setDebouncedSearchTerm('')
                  }}
                >
                  清空搜索
                </button>
              ) : null}
            </div>
            <div style={s.sortBox}>
              <label style={s.sortLabel} htmlFor="diary-sort-mode">
                排序方式
              </label>
              <select
                id="diary-sort-mode"
                style={s.sortSelect}
                value={sortMode}
                onChange={event => setSortMode(event.target.value as PublishedSortMode)}
              >
                <option value="hot">热度优先</option>
                <option value="time">时间优先</option>
                <option value="rating">评分优先</option>
              </select>
            </div>
          </div>
        ) : null}

        {actionMessage ? <div style={s.actionMessage}>{actionMessage}</div> : null}

        <LoginPromptModal
          open={loginPromptOpen}
          title={loginPromptTitle}
          description={loginPromptDescription}
          onCancel={() => setLoginPromptOpen(false)}
          onConfirm={() => router.push(loginNextUrl)}
        />

        {loading ? (
          <div style={s.empty}>加载中...</div>
        ) : error ? (
          <div style={s.emptyCard}>
            <div style={s.emptyTitle}>日记数据加载失败</div>
            <div style={s.emptyDesc}>{error}</div>
          </div>
        ) : visibleDiaries.length === 0 ? (
          <div style={s.emptyCard}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📔</div>
            <div style={s.emptyTitle}>{viewMode === 'draft' ? '草稿箱是空的' : viewMode === 'archived' ? '归档箱是空的' : searchTerm ? '没有匹配结果' : '还没有日记'}</div>
            <div style={s.emptyDesc}>
              {viewMode === 'draft'
                ? '你保存的草稿会显示在这里，方便后续继续编辑。'
                : viewMode === 'archived'
                ? '你归档的日记会显示在这里，可随时恢复到草稿箱。'
                : searchTerm
                ? '试试更换关键词，或者缩小搜索范围。'
                : '当前场景下还没有公开日记，或者数据库里还没有发布内容'}
            </div>
            <button
              style={s.emptyBtn}
              onClick={() => router.push(selectedSceneId ? `/diary/write?sceneId=${selectedSceneId}` : '/diary/write')}
            >
              {viewMode === 'archived' ? '去草稿箱查看' : viewMode === 'draft' ? '去写一篇草稿' : '写第一篇日记'}
            </button>
          </div>
        ) : (
          <div style={s.list}>
            {visibleDiaries.map(diary => (
              <div
                key={diary.id}
                style={{ ...s.card, cursor: 'pointer' }}
                onClick={() => router.push(`/diary/${diary.id}`)}
              >
                <div style={s.cardMain}>
                  <div style={s.cardTitle}>{renderHighlightedText(diary.title, searchKeywords)}</div>
                  <div style={s.cardMeta}>
                    {diary.status === 'draft' ? (
                      <span style={s.draftTag}>草稿</span>
                    ) : diary.status === 'archived' ? (
                      <span style={s.archiveTag}>已归档</span>
                    ) : null}
                    {diary.location_tag && (
                      <span style={s.location}>📍 {renderHighlightedText(diary.location_tag, searchKeywords)}</span>
                    )}
                    <span style={s.author}>{getAuthorName(diary)}</span>
                    <span style={s.date}>{formatDate(diary.created_at)}</span>
                  </div>
                  {viewMode === 'published' && debouncedSearchTerm ? (
                    <div style={s.snippetText}>
                      {renderHighlightedText(buildContentSnippet(diary.content_raw), searchKeywords)}
                    </div>
                  ) : null}
                </div>
                <div style={s.cardStats}>
                  {viewMode === 'published' ? (
                    <div
                      style={s.bookmarkWrap}
                      onMouseEnter={() => setHoveredBookmarkDiaryId(diary.id)}
                      onMouseLeave={() => setHoveredBookmarkDiaryId(previous => (previous === diary.id ? null : previous))}
                    >
                      <button
                        style={
                          bookmarkedDiaryIds.has(diary.id)
                            ? animatedBookmarkDiaryId === diary.id
                              ? s.bookmarkStarActiveAnimated
                              : s.bookmarkStarActive
                            : s.bookmarkStarBtn
                        }
                        onClick={event => {
                          event.stopPropagation()
                          handleToggleBookmark(diary.id)
                        }}
                        disabled={bookmarkingDiaryId === diary.id}
                        title={bookmarkedDiaryIds.has(diary.id) ? '取消收藏' : '收藏'}
                        aria-label={bookmarkedDiaryIds.has(diary.id) ? '取消收藏' : '收藏'}
                      >
                        {bookmarkingDiaryId === diary.id ? '...' : '★'}
                      </button>
                      {hoveredBookmarkDiaryId === diary.id ? (
                        <div style={s.bookmarkTooltip}>{bookmarkedDiaryIds.has(diary.id) ? '取消收藏' : '收藏这篇日记'}</div>
                      ) : null}
                    </div>
                  ) : null}
                  {viewMode === 'draft' ? (
                    <button
                      style={s.editDraftBtn}
                      onClick={event => {
                        event.stopPropagation()
                        const query = diary.scene_id
                          ? `/diary/write?diaryId=${diary.id}&sceneId=${diary.scene_id}`
                          : `/diary/write?diaryId=${diary.id}`
                        router.push(query)
                      }}
                    >
                      继续编辑
                    </button>
                  ) : null}
                  {viewMode === 'archived' ? (
                    <button
                      style={s.restoreBtn}
                      onClick={event => {
                        event.stopPropagation()
                        handleRestoreDiary(diary.id)
                      }}
                      disabled={restoringDiaryId === diary.id}
                    >
                      {restoringDiaryId === diary.id ? '恢复中...' : '恢复草稿'}
                    </button>
                  ) : null}
                  <span>👁 {diary.view_count}</span>
                  {viewMode === 'published' ? (
                    ratingSummaries[diary.id]?.averageRating !== null ? (
                      <span>
                        ⭐ {ratingSummaries[diary.id]?.averageRating} · {ratingSummaries[diary.id]?.ratingCount} 人评分
                      </span>
                    ) : diary.score !== null ? (
                      <span>⭐ {diary.score}</span>
                    ) : null
                  ) : diary.score !== null ? (
                    <span>⭐ {diary.score}</span>
                  ) : null}
                  {viewMode === 'published' && debouncedSearchTerm ? (
                    <span>命中 {getTotalKeywordHits(diary)} 次</span>
                  ) : null}
                </div>
              </div>
            ))}

            {viewMode === 'published' ? (
              <div style={s.paginationRow}>
                <button
                  style={s.pageBtn}
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(previous => Math.max(1, previous - 1))}
                >
                  上一页
                </button>
                <span style={s.pageInfo}>第 {currentPage} / {totalPublishedPages} 页 · 共 {totalPublished} 条</span>
                <button
                  style={s.pageBtn}
                  disabled={currentPage >= totalPublishedPages}
                  onClick={() => setCurrentPage(previous => Math.min(totalPublishedPages, previous + 1))}
                >
                  下一页
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </PageShell>
  )
}

const s: Record<string, React.CSSProperties> = {
  writeBtn: {
    padding: '8px 16px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  content: {
    padding: '0',
  },
  scenePanel: {
    background: '#fff',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    marginBottom: '16px',
  },
  panelTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '10px',
  },
  panelText: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: 1.7,
  },
  sceneSelect: {
    width: '100%',
    maxWidth: '420px',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid #dbe2f1',
    marginBottom: '14px',
    background: '#fff',
    color: '#111827',
  },
  sceneSummary: {
    padding: '16px',
    borderRadius: '14px',
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
  },
  sceneName: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '6px',
  },
  sceneMeta: {
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: 1.7,
  },
  modeRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px',
  },
  toolbarRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    marginBottom: '16px',
  },
  searchBox: {
    flex: '1 1 320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  sortBox: {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  searchLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
  },
  searchInput: {
    flex: 1,
    minWidth: '220px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
  },
  searchInputRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  searchBtn: {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid #0f766e',
    background: '#0f766e',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  clearSearchBtn: {
    marginTop: '8px',
    alignSelf: 'flex-start',
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#4b5563',
    fontSize: '12px',
    cursor: 'pointer',
  },
  sortRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  modeBtn: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 600,
  },
  sortBtn: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 600,
  },
  sortBtnActive: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid #0f766e',
    background: '#0f766e',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  modeBtnActive: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid #4f46e5',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    padding: '60px 0',
  },
  emptyCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '60px',
    textAlign: 'center',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px',
  },
  emptyDesc: {
    fontSize: '14px',
    color: '#9ca3af',
    marginBottom: '24px',
  },
  emptyBtn: {
    padding: '10px 24px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  actionMessage: {
    marginBottom: '14px',
    fontSize: '13px',
    color: '#065f46',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '8px',
    padding: '8px 10px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px 24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  cardMain: {
    flex: 1,
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: '6px',
  },
  cardMeta: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  snippetText: {
    marginTop: '8px',
    fontSize: '12px',
    lineHeight: 1.6,
    color: '#6b7280',
  },
  highlightMark: {
    background: '#fef08a',
    color: '#111827',
    borderRadius: '4px',
    padding: '0 2px',
  },
  location: {
    fontSize: '13px',
    color: '#4f46e5',
  },
  draftTag: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '999px',
    background: '#fef3c7',
    color: '#92400e',
    fontWeight: 600,
  },
  archiveTag: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '999px',
    background: '#e5e7eb',
    color: '#374151',
    fontWeight: 600,
  },
  author: {
    fontSize: '13px',
    color: '#6b7280',
  },
  date: {
    fontSize: '13px',
    color: '#9ca3af',
  },
  cardStats: {
    display: 'flex',
    gap: '12px',
    fontSize: '13px',
    color: '#9ca3af',
    alignItems: 'center',
    marginLeft: '16px',
  },
  bookmarkStarBtn: {
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#9ca3af',
    borderRadius: '10px',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1,
    padding: 0,
    transition: 'transform 180ms ease, box-shadow 180ms ease',
  },
  bookmarkStarActive: {
    border: '1px solid #f59e0b',
    background: '#fffbeb',
    color: '#f59e0b',
    borderRadius: '10px',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1,
    padding: 0,
    transition: 'transform 180ms ease, box-shadow 180ms ease',
  },
  bookmarkStarActiveAnimated: {
    border: '1px solid #f59e0b',
    background: '#fffbeb',
    color: '#f59e0b',
    borderRadius: '10px',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1,
    padding: 0,
    transform: 'scale(1.12)',
    boxShadow: '0 0 0 4px rgba(245,158,11,0.14)',
    transition: 'transform 180ms ease, box-shadow 180ms ease',
  },
  bookmarkWrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  bookmarkTooltip: {
    position: 'absolute',
    top: '-30px',
    right: '-8px',
    whiteSpace: 'nowrap',
    padding: '4px 8px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: '#111827',
    color: '#fff',
    fontSize: '11px',
    lineHeight: 1.2,
    zIndex: 2,
  },
  editDraftBtn: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid #4f46e5',
    color: '#4f46e5',
    background: '#eef2ff',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  restoreBtn: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid #059669',
    color: '#065f46',
    background: '#ecfdf5',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  paginationRow: {
    marginTop: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  pageBtn: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  pageInfo: {
    fontSize: '13px',
    color: '#6b7280',
  },
}