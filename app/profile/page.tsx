'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageShell from '../components/page-shell'
import { supabase } from '../lib/supabase'

type ProfileRow = {
  user_id: string
  display_name: string | null
  questionnaire_done: boolean | null
  travel_style: string[] | null
  budget_level: number | null
  group_type: string | null
  preferences: {
    taboos?: string[]
    profile_avatar_url?: string
    profile_intro?: string
  } | null
  updated_at: string | null
}

type DiaryStatRow = {
  status: 'draft' | 'published' | 'archived'
  count: number
}

type RecentDiary = {
  id: string
  title: string
  status: 'draft' | 'published' | 'archived'
  created_at: string
  location_tag: string | null
  scene_id: string | null
}

type FavoriteDiary = {
  id: string
  title: string
  location_tag: string | null
  created_at: string
  bookmarked_at: string
}

type SceneLite = {
  id: string
  name: string
  city: string | null
  last_visited_at: string
}

type SceneVisitRow = {
  scene_id: string
  last_visited_at: string
}

type RecentReview = {
  diary_id: string
  rating: number
  updated_at: string
  title: string
  average_score: number | null
}

type SectionErrors = {
  overview?: string
  recentDiaries?: string
  favorites?: string
  recentScenes?: string
  recentReviews?: string
}

const TRAVEL_STYLE_LABELS: Record<string, string> = {
  culture: '文化历史',
  nature: '自然风光',
  food: '美食之旅',
  city: '都市探索',
  relax: '休闲度假',
  adventure: '户外探险',
}

const GROUP_LABELS: Record<string, string> = {
  solo: '独自旅行',
  couple: '情侣出游',
  family: '家庭出游',
  group: '朋友结伴',
}

const TABOO_LABELS: Record<string, string> = {
  no_spicy: '不吃辣',
  no_seafood: '不吃海鲜',
  no_pork: '不吃猪肉',
  no_climb: '避免爬山',
  no_crowd: '避开人多',
  no_night: '不喜夜行',
}

const BUDGET_LABELS: Record<number, string> = {
  1: '经济实惠',
  2: '舒适出行',
  3: '品质享受',
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [diaryStats, setDiaryStats] = useState<Record<'draft' | 'published' | 'archived', number>>({
    draft: 0,
    published: 0,
    archived: 0,
  })
  const [bookmarkCount, setBookmarkCount] = useState(0)
  const [recentDiaries, setRecentDiaries] = useState<RecentDiary[]>([])
  const [favoriteDiaries, setFavoriteDiaries] = useState<FavoriteDiary[]>([])
  const [recentScenes, setRecentScenes] = useState<SceneLite[]>([])
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([])
  const [sectionErrors, setSectionErrors] = useState<SectionErrors>({})
  const [refreshTick, setRefreshTick] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfilePage() {
      setLoading(true)
      setError(null)
      setSectionErrors({})

      const { data: authData, error: authError } = await supabase.auth.getUser()

      if (authError || !authData.user) {
        router.push('/auth/login')
        return
      }

      const user = authData.user
      setEmail(user.email ?? '')

      const [profileResult, diaryResult, bookmarkResult, recentDiaryResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, display_name, questionnaire_done, travel_style, budget_level, group_type, preferences, updated_at')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('diaries')
          .select('status, count:id')
          .eq('user_id', user.id)
          .returns<DiaryStatRow[]>(),
        supabase
          .from('bookmarks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('target_type', 'diary'),
        supabase
          .from('diaries')
          .select('id, title, status, created_at, location_tag, scene_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (profileResult.error) {
        setError(profileResult.error.message)
        setLoading(false)
        return
      }

      const nextProfile = (profileResult.data ?? null) as ProfileRow | null
      setProfile(nextProfile)
      setDisplayName(nextProfile?.display_name ?? user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '旅行者')
      setAvatarUrl(typeof nextProfile?.preferences?.profile_avatar_url === 'string' ? nextProfile.preferences.profile_avatar_url : typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : '')

      const nextSectionErrors: SectionErrors = {}

      if (diaryResult.error) {
        nextSectionErrors.overview = `统计加载失败：${diaryResult.error.message}`
      }

      if (bookmarkResult.error) {
        nextSectionErrors.overview = nextSectionErrors.overview
          ? `${nextSectionErrors.overview}；收藏统计加载失败`
          : `收藏统计加载失败：${bookmarkResult.error.message}`
      }

      const diaryCounts = { draft: 0, published: 0, archived: 0 }
      for (const row of (diaryResult.data ?? []) as DiaryStatRow[]) {
        diaryCounts[row.status] += 1
      }
      setDiaryStats(diaryCounts)

      setBookmarkCount(bookmarkResult.count ?? 0)

      if (recentDiaryResult.error) {
        nextSectionErrors.recentDiaries = `最近日记加载失败：${recentDiaryResult.error.message}`
      }

      const nextRecentDiaries = (recentDiaryResult.data ?? []) as RecentDiary[]
      setRecentDiaries(nextRecentDiaries)

      const [favoriteRowsResult, recentReviewRowsResult, sceneVisitRowsResult] = await Promise.all([
        supabase
          .from('bookmarks')
          .select('target_id, created_at')
          .eq('user_id', user.id)
          .eq('target_type', 'diary')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('diary_reviews')
          .select('diary_id, rating, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(8),
        supabase
          .from('scene_visit_logs')
          .select('scene_id, last_visited_at')
          .eq('user_id', user.id)
          .order('last_visited_at', { ascending: false })
          .limit(8),
      ])

      if (favoriteRowsResult.error) {
        nextSectionErrors.favorites = `收藏列表加载失败：${favoriteRowsResult.error.message}`
      }

      if (recentReviewRowsResult.error) {
        nextSectionErrors.recentReviews = `评分记录加载失败：${recentReviewRowsResult.error.message}`
      }

      if (sceneVisitRowsResult.error) {
        nextSectionErrors.recentScenes = `场景访问记录加载失败：${sceneVisitRowsResult.error.message}`
      }

      const favoriteDiaryIds = Array.from(new Set((favoriteRowsResult.data ?? []).map(row => row.target_id).filter(Boolean)))
      const reviewDiaryIds = Array.from(new Set((recentReviewRowsResult.data ?? []).map(row => row.diary_id).filter(Boolean)))
      const sceneVisitRows = (sceneVisitRowsResult.data ?? []) as SceneVisitRow[]
      const sceneIds = Array.from(new Set(sceneVisitRows.map(row => row.scene_id).filter(Boolean)))
      const relatedDiaryIds = Array.from(new Set([...favoriteDiaryIds, ...reviewDiaryIds]))

      const [relatedDiaryResult, sceneResult] = await Promise.all([
        relatedDiaryIds.length > 0
          ? supabase
              .from('diaries')
              .select('id, title, location_tag, created_at, score')
              .in('id', relatedDiaryIds)
          : Promise.resolve({ data: [], error: null }),
        sceneIds.length > 0
          ? supabase
              .from('scenes')
              .select('id, name, city')
              .in('id', sceneIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (relatedDiaryResult.error) {
        if (!nextSectionErrors.favorites) {
          nextSectionErrors.favorites = `收藏内容解析失败：${relatedDiaryResult.error.message}`
        }
        if (!nextSectionErrors.recentReviews) {
          nextSectionErrors.recentReviews = `评分内容解析失败：${relatedDiaryResult.error.message}`
        }
      }

      if (sceneResult.error && !nextSectionErrors.recentScenes) {
        nextSectionErrors.recentScenes = `场景详情加载失败：${sceneResult.error.message}`
      }

      const favoriteDiaryMap = new Map((relatedDiaryResult.data ?? []).map(item => [item.id, item]))
      const reviewedDiaryMap = new Map((relatedDiaryResult.data ?? []).map(item => [item.id, item.title]))
      const sceneMap = new Map((sceneResult.data ?? []).map(item => [item.id, item]))

      const nextFavoriteDiaries: FavoriteDiary[] = []
      for (const row of favoriteRowsResult.data ?? []) {
        const matched = favoriteDiaryMap.get(row.target_id)
        if (!matched) {
          continue
        }

        nextFavoriteDiaries.push({
          id: matched.id,
          title: matched.title,
          location_tag: matched.location_tag,
          created_at: matched.created_at,
          bookmarked_at: row.created_at,
        })
      }

      const nextRecentReviews: RecentReview[] = []
      for (const row of recentReviewRowsResult.data ?? []) {
        const relatedDiary = favoriteDiaryMap.get(row.diary_id)
        if (!relatedDiary) {
          continue
        }

        nextRecentReviews.push({
          diary_id: row.diary_id,
          rating: Number(row.rating),
          updated_at: row.updated_at,
          title: relatedDiary.title,
          average_score: typeof relatedDiary.score === 'number' ? relatedDiary.score : null,
        })
      }

      const nextRecentScenes: SceneLite[] = []
      for (const visit of sceneVisitRows) {
        const scene = sceneMap.get(visit.scene_id)
        if (!scene) {
          continue
        }
        nextRecentScenes.push({
          ...scene,
          last_visited_at: visit.last_visited_at,
        })

        if (nextRecentScenes.length >= 6) {
          break
        }
      }

      setFavoriteDiaries(nextFavoriteDiaries)
      setRecentReviews(nextRecentReviews)
      setRecentScenes(nextRecentScenes)
      setSectionErrors(nextSectionErrors)
      setLoading(false)
    }

    loadProfilePage()
  }, [refreshTick, router])

  function handleRefresh() {
    setRefreshTick(prev => prev + 1)
  }

  const travelStyleLabels = useMemo(
    () => profile?.travel_style?.map(item => TRAVEL_STYLE_LABELS[item]).filter(Boolean) ?? [],
    [profile?.travel_style],
  )

  const tabooLabels = useMemo(
    () => profile?.preferences?.taboos?.map(item => TABOO_LABELS[item]).filter(Boolean) ?? [],
    [profile?.preferences?.taboos],
  )

  const savedIntro = useMemo(() => {
    const raw = profile?.preferences?.profile_intro
    if (typeof raw !== 'string') {
      return ''
    }

    return raw.trim()
  }, [profile?.preferences])

  const profileBio = useMemo(() => {
    if (savedIntro) {
      return savedIntro
    }

    const styleText = travelStyleLabels.slice(0, 2).join(' · ')
    const groupText = profile?.group_type ? GROUP_LABELS[profile.group_type] : ''

    if (styleText && groupText) {
      return `偏好 ${styleText}，常与${groupText}一起旅行。`
    }

    if (styleText) {
      return `偏好 ${styleText}。`
    }

    if (groupText) {
      return `常与${groupText}一起旅行。`
    }

    return '完善问卷后，这里会展示你的旅行偏好和风格。'
  }, [profile?.group_type, savedIntro, travelStyleLabels])

  function formatDate(str: string) {
    return new Date(str).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  function formatRelativeTime(str: string) {
    const target = new Date(str).getTime()
    const now = Date.now()
    const diffMs = Math.max(0, now - target)
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    if (diffMs < minute) {
      return '刚刚'
    }

    if (diffMs < hour) {
      return `${Math.floor(diffMs / minute)}分钟前`
    }

    if (diffMs < day) {
      return `${Math.floor(diffMs / hour)}小时前`
    }

    return `${Math.floor(diffMs / day)}天前`
  }

  function formatScore(score: number | null) {
    if (typeof score !== 'number') {
      return '暂无'
    }

    return score.toFixed(1)
  }

  return (
    <PageShell
      backHref="/dashboard"
      title="个人主页"
      subtitle="查看你的旅行偏好、日记与收藏"
      actions={(
        <button style={styles.logoutBtn} onClick={() => supabase.auth.signOut().then(() => router.push('/auth/login'))}>
          退出登录
        </button>
      )}
      contentMaxWidth="980px"
    >
      <div>
        {loading ? (
          <div style={styles.loadingCard}>个人主页加载中...</div>
        ) : error ? (
          <div style={styles.errorCard}>{error}</div>
        ) : (
          <>
            <div style={styles.hero}>
              <div style={styles.heroLeft}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="头像" style={styles.avatarImage} />
                ) : (
                  <div style={styles.avatar}>{(displayName || email || 'T').slice(0, 1).toUpperCase()}</div>
                )}
              </div>
              <div style={styles.heroMain}>
                <div style={styles.nameRow}>
                  <div>
                    <div style={styles.name}>{displayName}</div>
                    <div style={styles.email}>{email}</div>
                  </div>
                  <span style={profile?.questionnaire_done ? styles.stateDone : styles.statePending}>
                    {profile?.questionnaire_done ? '已完成问卷' : '未完成问卷'}
                  </span>
                </div>

                <div style={styles.bio}>{profileBio}</div>

                <div style={styles.metaRow}>
                  <span style={styles.badge}>最近更新：{profile?.updated_at ? formatDate(profile.updated_at) : '暂无'}</span>
                  <span style={styles.badge}>日记 {diaryStats.published}</span>
                  <span style={styles.badge}>收藏 {bookmarkCount}</span>
                </div>
              </div>
            </div>

            <div style={styles.quickActions}>
              <button style={styles.primaryBtn} onClick={() => router.push('/diary')}>去我的日记</button>
              <button style={styles.secondaryBtn} onClick={() => router.push('/profile/edit')}>编辑资料</button>
              <button style={styles.secondaryBtn} onClick={() => router.push('/scenes')}>去选场景</button>
              <button style={styles.secondaryBtn} onClick={() => router.push('/onboarding')}>更新偏好问卷</button>
              <button style={styles.secondaryBtn} onClick={handleRefresh}>刷新数据</button>
            </div>

            {sectionErrors.overview ? <div style={styles.warningText}>{sectionErrors.overview}</div> : null}

            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{diaryStats.published}</div>
                <div style={styles.statLabel}>已发布日记</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{diaryStats.draft}</div>
                <div style={styles.statLabel}>草稿</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{diaryStats.archived}</div>
                <div style={styles.statLabel}>已归档</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{bookmarkCount}</div>
                <div style={styles.statLabel}>日记收藏</div>
              </div>
            </div>

            <div style={styles.grid}>
              <div style={styles.card}>
                <div style={styles.cardTitle}>旅行偏好</div>
                <div style={styles.sectionRow}>
                  <span style={styles.sectionLabel}>旅行风格</span>
                  <div style={styles.tagWrap}>
                    {travelStyleLabels.length > 0 ? travelStyleLabels.map(item => <span key={item} style={styles.tag}>{item}</span>) : <span style={styles.emptyText}>未填写</span>}
                  </div>
                </div>
                <div style={styles.sectionRow}>
                  <span style={styles.sectionLabel}>预算</span>
                  <span style={styles.valueText}>{profile?.budget_level ? BUDGET_LABELS[profile.budget_level] : '未填写'}</span>
                </div>
                <div style={styles.sectionRow}>
                  <span style={styles.sectionLabel}>同行人群</span>
                  <span style={styles.valueText}>{profile?.group_type ? GROUP_LABELS[profile.group_type] : '未填写'}</span>
                </div>
                <div style={styles.sectionRow}>
                  <span style={styles.sectionLabel}>禁忌</span>
                  <div style={styles.tagWrap}>
                    {tabooLabels.length > 0 ? tabooLabels.map(item => <span key={item} style={styles.tagMuted}>{item}</span>) : <span style={styles.emptyText}>未填写</span>}
                  </div>
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardTitle}>最近日记</div>
                <div style={styles.list}>
                  {sectionErrors.recentDiaries ? (
                    <div style={styles.errorInline}>{sectionErrors.recentDiaries}</div>
                  ) : recentDiaries.length > 0 ? recentDiaries.map(diary => (
                    <div key={diary.id} style={styles.listRow}>
                      <button style={styles.listItemGrow} onClick={() => router.push(`/diary/${diary.id}`)}>
                        <div style={styles.listMain}>
                          <div style={styles.listTitle}>{diary.title}</div>
                          <div style={styles.listMeta}>{diary.location_tag ?? '未设置地点'} · {formatDate(diary.created_at)}</div>
                        </div>
                      </button>
                      {diary.scene_id ? (
                        <button style={styles.sceneEntryBtn} onClick={() => router.push(`/scenes/${diary.scene_id}`)}>
                          关联场景
                        </button>
                      ) : null}
                      <span style={diary.status === 'published' ? styles.statusPub : diary.status === 'draft' ? styles.statusDraft : styles.statusArch}>
                        {diary.status === 'published' ? '已发布' : diary.status === 'draft' ? '草稿' : '已归档'}
                      </span>
                    </div>
                  )) : <div style={styles.emptyText}>还没有创建日记</div>}
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardTitle}>我的收藏</div>
                <div style={styles.list}>
                  {sectionErrors.favorites ? (
                    <div style={styles.errorInline}>{sectionErrors.favorites}</div>
                  ) : favoriteDiaries.length > 0 ? favoriteDiaries.map(diary => (
                    <button key={diary.id} style={styles.listItem} onClick={() => router.push(`/diary/${diary.id}`)}>
                      <div style={styles.listMain}>
                        <div style={styles.listTitle}>{diary.title}</div>
                        <div style={styles.listMeta}>{diary.location_tag ?? '未设置地点'} · 收藏于 {formatRelativeTime(diary.bookmarked_at)}</div>
                      </div>
                      <span style={styles.statusPub}>已收藏</span>
                    </button>
                  )) : <div style={styles.emptyText}>还没有收藏日记</div>}
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardTitle}>最近访问场景</div>
                <div style={styles.list}>
                  {sectionErrors.recentScenes ? (
                    <div style={styles.errorInline}>{sectionErrors.recentScenes}</div>
                  ) : recentScenes.length > 0 ? recentScenes.map(scene => (
                    <button key={scene.id} style={styles.listItem} onClick={() => router.push(`/scenes/${scene.id}`)}>
                      <div style={styles.listMain}>
                        <div style={styles.listTitle}>{scene.name}</div>
                        <div style={styles.listMeta}>{scene.city ?? '未填写城市'} · 最近访问 {formatRelativeTime(scene.last_visited_at)}</div>
                      </div>
                      <span style={styles.statusDraft}>去看看</span>
                    </button>
                  )) : <div style={styles.emptyText}>还没有场景访问记录</div>}
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardTitle}>最近评分日记</div>
                <div style={styles.list}>
                  {sectionErrors.recentReviews ? (
                    <div style={styles.errorInline}>{sectionErrors.recentReviews}</div>
                  ) : recentReviews.length > 0 ? recentReviews.map(item => (
                    <button key={`${item.diary_id}-${item.updated_at}`} style={styles.listItem} onClick={() => router.push(`/diary/${item.diary_id}`)}>
                      <div style={styles.listMain}>
                        <div style={styles.listTitle}>{item.title}</div>
                        <div style={styles.listMeta}>我的评分 {item.rating.toFixed(1)} · 当前均分 {formatScore(item.average_score)}</div>
                        <div style={styles.listMeta}>评分于 {formatRelativeTime(item.updated_at)}</div>
                      </div>
                      <span style={styles.statusArch}>已评分</span>
                    </button>
                  )) : <div style={styles.emptyText}>还没有评分记录</div>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  logoutBtn: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 600,
  },
  loadingCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  errorCard: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    borderRadius: '16px',
    padding: '20px',
  },
  warningText: {
    marginBottom: '12px',
    borderRadius: '12px',
    border: '1px solid #fde68a',
    background: '#fffbeb',
    color: '#92400e',
    padding: '10px 12px',
    fontSize: '13px',
  },
  hero: {
    background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)',
    borderRadius: '20px',
    padding: '28px',
    color: '#fff',
    display: 'flex',
    gap: '18px',
    alignItems: 'center',
    marginBottom: '18px',
    flexWrap: 'wrap',
  },
  heroLeft: {
    flexShrink: 0,
  },
  heroMain: {
    minWidth: 0,
    flex: 1,
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    fontWeight: 800,
    flexShrink: 0,
    border: '2px solid rgba(255,255,255,0.22)',
    boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
  },
  avatarImage: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(255,255,255,0.22)',
    boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  name: {
    fontSize: '28px',
    fontWeight: 800,
    lineHeight: 1.2,
  },
  email: {
    fontSize: '14px',
    opacity: 0.85,
    marginTop: '4px',
  },
  bio: {
    marginTop: '12px',
    fontSize: '15px',
    lineHeight: 1.7,
    color: 'rgba(255,255,255,0.92)',
    maxWidth: '720px',
  },
  metaRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '14px',
  },
  badge: {
    padding: '5px 10px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.16)',
    fontSize: '12px',
  },
  stateDone: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'rgba(16,185,129,0.18)',
    border: '1px solid rgba(110,231,183,0.35)',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
  },
  statePending: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.22)',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
  },
  quickActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '18px',
  },
  primaryBtn: {
    padding: '10px 14px',
    borderRadius: '10px',
    border: 'none',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  secondaryBtn: {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 600,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
    marginBottom: '18px',
  },
  statCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#111827',
    lineHeight: 1.1,
  },
  statLabel: {
    marginTop: '6px',
    fontSize: '13px',
    color: '#6b7280',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#fff',
    borderRadius: '18px',
    padding: '22px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '16px',
  },
  sectionRow: {
    marginBottom: '14px',
  },
  sectionLabel: {
    display: 'block',
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '6px',
  },
  valueText: {
    fontSize: '14px',
    color: '#111827',
    fontWeight: 600,
  },
  tagWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  tag: {
    padding: '5px 10px',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#4338ca',
    fontSize: '12px',
    fontWeight: 600,
  },
  tagMuted: {
    padding: '5px 10px',
    borderRadius: '999px',
    background: '#f3f4f6',
    color: '#4b5563',
    fontSize: '12px',
    fontWeight: 600,
  },
  emptyText: {
    fontSize: '14px',
    color: '#9ca3af',
  },
  errorInline: {
    borderRadius: '12px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    padding: '10px 12px',
    fontSize: '13px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    textAlign: 'left',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    background: '#fff',
    padding: '14px 16px',
    cursor: 'pointer',
  },
  listRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  listItemGrow: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    textAlign: 'left',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    background: '#fff',
    padding: '14px 16px',
    cursor: 'pointer',
  },
  sceneEntryBtn: {
    border: '1px solid #dbeafe',
    background: '#eff6ff',
    color: '#1d4ed8',
    borderRadius: '10px',
    padding: '8px 10px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  listMain: {
    minWidth: 0,
  },
  listTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '4px',
  },
  listMeta: {
    fontSize: '12px',
    color: '#6b7280',
  },
  statusPub: {
    padding: '5px 8px',
    borderRadius: '999px',
    background: '#ecfdf5',
    color: '#047857',
    fontSize: '12px',
    fontWeight: 600,
    flexShrink: 0,
  },
  statusDraft: {
    padding: '5px 8px',
    borderRadius: '999px',
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '12px',
    fontWeight: 600,
    flexShrink: 0,
  },
  statusArch: {
    padding: '5px 8px',
    borderRadius: '999px',
    background: '#e5e7eb',
    color: '#374151',
    fontSize: '12px',
    fontWeight: 600,
    flexShrink: 0,
  },
}