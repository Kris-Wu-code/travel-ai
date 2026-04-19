'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PageShell from '../../components/page-shell'
import { supabase } from '../../lib/supabase'
import LoginPromptModal from '../../components/login-prompt-modal'
import { formatTransportList, getSceneTypeLabel, type SceneRecord } from '../../lib/scenes'

type EditableDiary = {
  id: string
  user_id: string
  scene_id: string | null
  title: string
  location_tag: string | null
  content_raw: string | null
  status: 'published' | 'draft' | 'archived'
}

type ScenePreview = Pick<
  SceneRecord,
  'id' | 'name' | 'scene_type' | 'city' | 'description' | 'available_transports'
>

export default function DiaryWriteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editDiaryId = searchParams.get('diaryId') ?? ''
  const initialSceneId = searchParams.get('sceneId') ?? ''
  const [sceneId, setSceneId] = useState(initialSceneId)
  const [title, setTitle] = useState('')
  const [locationTag, setLocationTag] = useState('')
  const [content, setContent] = useState('')
  const [savingStatus, setSavingStatus] = useState<'published' | 'draft' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(Boolean(editDiaryId))
  const [loadingScene, setLoadingScene] = useState(Boolean(initialSceneId))
  const [scenePreview, setScenePreview] = useState<ScenePreview | null>(null)
  const [editableStatus, setEditableStatus] = useState<'published' | 'draft' | 'archived' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const DRAFT_KEY = 'travel-ai:diary-write-draft'
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [loginNextUrl, setLoginNextUrl] = useState('')
  const [loginPromptTitle, setLoginPromptTitle] = useState('')
  const [loginPromptDescription, setLoginPromptDescription] = useState('')

  function buildSceneLocationTag(scene: ScenePreview) {
    return scene.city ? `${scene.city} · ${scene.name}` : scene.name
  }

  useEffect(() => {
    async function loadScenePreview() {
      if (!sceneId) {
        setScenePreview(null)
        setLoadingScene(false)
        return
      }

      setLoadingScene(true)

      const { data, error } = await supabase
        .from('scenes')
        .select('id, name, scene_type, city, description, available_transports')
        .eq('id', sceneId)
        .maybeSingle()

      if (error) {
        setMessage(`场景加载失败：${error.message}`)
        setScenePreview(null)
        setLoadingScene(false)
        return
      }

      setScenePreview((data ?? null) as ScenePreview | null)
      setLoadingScene(false)
    }

    loadScenePreview()
  }, [sceneId])

  useEffect(() => {
    if (!scenePreview || locationTag.trim()) {
      return
    }

    setLocationTag(buildSceneLocationTag(scenePreview))
  }, [locationTag, scenePreview])

  useEffect(() => {
    async function loadEditableDiary() {
      if (!editDiaryId) {
        setLoadingDraft(false)
        return
      }

      setLoadingDraft(true)
      setMessage(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setLoadingDraft(false)
        setMessage('登录后可继续编辑这篇日记，当前内容会保留在页面上。')
        return
      }

      const { data, error } = await supabase
        .from('diaries')
        .select('id, user_id, scene_id, title, location_tag, content_raw, status')
        .eq('id', editDiaryId)
        .maybeSingle()

      if (error) {
        setMessage(`草稿加载失败：${error.message}`)
        setLoadingDraft(false)
        return
      }

      const draft = (data ?? null) as EditableDiary | null
      if (!draft) {
        setMessage('未找到可编辑的日记')
        setLoadingDraft(false)
        return
      }

      if (draft.user_id !== user.id) {
        setMessage('你没有权限编辑这篇日记')
        setLoadingDraft(false)
        return
      }

      setTitle(draft.title ?? '')
      setLocationTag(draft.location_tag ?? '')
      setContent(draft.content_raw ?? '')
      setEditableStatus(draft.status)
      if (!initialSceneId && draft.scene_id) {
        setSceneId(draft.scene_id)
      }
      setLoadingDraft(false)
    }

    loadEditableDiary()
  }, [editDiaryId, initialSceneId, router])

  useEffect(() => {
    if (editDiaryId || typeof window === 'undefined') {
      return
    }

    const draftText = window.sessionStorage.getItem(DRAFT_KEY)
    if (!draftText) {
      return
    }

    try {
      const draft = JSON.parse(draftText) as {
        title?: string
        locationTag?: string
        content?: string
        sceneId?: string
      }

      setTitle(typeof draft.title === 'string' ? draft.title : '')
      setLocationTag(typeof draft.locationTag === 'string' ? draft.locationTag : '')
      setContent(typeof draft.content === 'string' ? draft.content : '')
      if (typeof draft.sceneId === 'string' && draft.sceneId) {
        setSceneId(draft.sceneId)
      }
      window.sessionStorage.removeItem(DRAFT_KEY)
      setMessage('已恢复你上次未保存的草稿内容')
    } catch {
      window.sessionStorage.removeItem(DRAFT_KEY)
    }
  }, [editDiaryId])

  async function saveDiary(status: 'published' | 'draft') {
    if (!title.trim()) {
      setMessage('请先填写标题')
      return
    }

    if (status === 'published' && !content.trim()) {
      setMessage('发布前请填写正文内容')
      return
    }

    setSavingStatus(status)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setSavingStatus(null)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            title,
            locationTag,
            content,
            sceneId,
          }),
        )
      }
      const nextPath = `/diary/write${editDiaryId ? `?diaryId=${editDiaryId}${sceneId ? `&sceneId=${sceneId}` : ''}` : sceneId ? `?sceneId=${sceneId}` : ''}`
      setLoginNextUrl(`/auth/login?next=${encodeURIComponent(nextPath)}`)
      setLoginPromptTitle('登录后可保存这篇日记')
      setLoginPromptDescription('我们会保留你刚才填写的内容，登录后自动回到写作页继续保存。')
      setLoginPromptOpen(true)
      setMessage('登录后可保存这篇日记，我们会保留当前内容。')
      return
    }

    const rawSize = new TextEncoder().encode(content).length

    let savedDiaryId = editDiaryId

    if (editDiaryId) {
      const { error } = await supabase
        .from('diaries')
        .update({
          scene_id: sceneId || null,
          title: title.trim(),
          location_tag: locationTag.trim() || null,
          content_raw: content.trim() || null,
          raw_size: rawSize > 0 ? rawSize : null,
          compressed_size: rawSize > 0 ? rawSize : null,
          compression_algo: 'none',
          status,
        })
        .eq('id', editDiaryId)
        .eq('user_id', user.id)

      setSavingStatus(null)

      if (error) {
        setMessage(`保存失败：${error.message}`)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('diaries')
        .insert({
          user_id: user.id,
          scene_id: sceneId || null,
          title: title.trim(),
          location_tag: locationTag.trim() || null,
          content_raw: content.trim() || null,
          raw_size: rawSize > 0 ? rawSize : null,
          compressed_size: rawSize > 0 ? rawSize : null,
          compression_algo: 'none',
          status,
        })
        .select('id')
        .single()

      setSavingStatus(null)

      if (error) {
        setMessage(`保存失败：${error.message}`)
        return
      }

      if (data?.id) {
        savedDiaryId = data.id
      }
    }

    if (status === 'published') {
      router.push(sceneId ? `/diary?sceneId=${sceneId}` : '/diary')
      return
    }

    setMessage(editDiaryId ? '草稿更新成功' : '草稿保存成功')
    if (savedDiaryId) {
      router.push(`/diary/${savedDiaryId}`)
    }
  }

  async function handleArchiveDiary() {
    if (!editDiaryId) {
      return
    }

    if (editableStatus !== 'draft' && editableStatus !== 'published') {
      setMessage('当前状态不支持归档')
      return
    }

    const diaryTypeText = editableStatus === 'published' ? '已发布日记' : '草稿'
    const confirmed = window.confirm(`确认归档这篇${diaryTypeText}吗？归档后可在"已归档"中恢复。`)
    if (!confirmed) {
      return
    }

    setDeleting(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setDeleting(false)
      const nextPath = `/diary/write${editDiaryId ? `?diaryId=${editDiaryId}${sceneId ? `&sceneId=${sceneId}` : ''}` : sceneId ? `?sceneId=${sceneId}` : ''}`
      setLoginNextUrl(`/auth/login?next=${encodeURIComponent(nextPath)}`)
      setLoginPromptTitle('登录后可归档这篇日记')
      setLoginPromptDescription('归档是作者操作，登录后会自动回到当前写作页。')
      setLoginPromptOpen(true)
      setMessage('登录后可继续归档这篇日记。')
      return
    }

    const { error } = await supabase
      .from('diaries')
      .update({ status: 'archived' })
      .eq('id', editDiaryId)
      .eq('user_id', user.id)

    setDeleting(false)

    if (error) {
      setMessage(`归档失败：${error.message}`)
      return
    }

    setEditableStatus('archived')
    setMessage('已归档，可在"已归档"中恢复')
    router.push('/diary')
  }

  return (
    <PageShell
      backHref={editDiaryId ? `/diary/${editDiaryId}` : sceneId ? `/scenes/${sceneId}` : '/diary'}
      title={editDiaryId ? editableStatus === 'published' ? '编辑日记' : '编辑草稿' : '写日记'}
      subtitle={editDiaryId ? '继续完善你的旅行故事' : '记录你的旅行故事'}
      contentMaxWidth="860px"
    >
      <div>
        <div style={styles.sceneHint}>
          <div style={styles.sceneTitle}>写作上下文</div>
          {loadingScene ? (
            <div style={styles.sceneText}>正在加载场景信息...</div>
          ) : scenePreview ? (
            <>
              <div style={styles.sceneText}>
                当前来自场景：{scenePreview.name} · {getSceneTypeLabel(scenePreview.scene_type)} · {scenePreview.city ?? '未填写城市'}
              </div>
              <div style={styles.sceneMeta}>可用交通：{formatTransportList(scenePreview.available_transports)}</div>
              <div style={styles.sceneMeta}>后续会自动回到该场景的公开日记列表。</div>
            </>
          ) : (
            <div style={styles.sceneText}>未选择场景，日记仍可正常创建，后续会自动关联目的地标签与场景 ID。</div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.field}>
            <label style={styles.label}>标题</label>
            <input
              style={styles.input}
              placeholder="例如：故宫三日游"
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>目的地标签</label>
            <input
              style={styles.input}
              placeholder={scenePreview ? buildSceneLocationTag(scenePreview) : '例如：北京·故宫'}
              value={locationTag}
              onChange={event => setLocationTag(event.target.value)}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>正文</label>
            <textarea
              style={styles.textarea}
              placeholder="记录你的旅行故事..."
              value={content}
              onChange={event => setContent(event.target.value)}
            />
          </div>

          {message ? <div style={styles.message}>{message}</div> : null}

          <LoginPromptModal
            open={loginPromptOpen}
            title={loginPromptTitle}
            description={loginPromptDescription}
            confirmLabel="去登录"
            cancelLabel="暂不登录"
            onCancel={() => setLoginPromptOpen(false)}
            onConfirm={() => router.push(loginNextUrl)}
          />

          <div style={styles.actions}>
            <button
              style={styles.primaryBtn}
              onClick={() => saveDiary('published')}
              disabled={savingStatus !== null || loadingDraft || deleting}
            >
              {savingStatus === 'published' ? '发布中...' : editDiaryId ? '发布更新' : '发布日记'}
            </button>
            <button
              style={styles.secondaryBtn}
              onClick={() => saveDiary('draft')}
              disabled={savingStatus !== null || loadingDraft || deleting}
            >
              {savingStatus === 'draft' ? '保存中...' : editDiaryId ? '更新草稿' : '保存草稿'}
            </button>
            {editDiaryId && (editableStatus === 'draft' || editableStatus === 'published') ? (
              <button
                style={styles.dangerBtn}
                onClick={handleArchiveDiary}
                disabled={savingStatus !== null || loadingDraft || deleting}
              >
                {deleting ? '归档中...' : editableStatus === 'published' ? '归档日记' : '归档草稿'}
              </button>
            ) : null}
          </div>

          <p style={styles.hint}>后续这里会接入 Huffman 压缩、图片上传和 AIGC 动画生成。</p>
        </div>
      </div>
    </PageShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  sceneHint: {
    background: '#eff6ff',
    border: '1px solid #dbeafe',
    borderRadius: '16px',
    padding: '18px 20px',
    marginBottom: '16px',
  },
  sceneTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#1d4ed8',
    marginBottom: '6px',
  },
  sceneText: {
    fontSize: '14px',
    lineHeight: 1.7,
    color: '#1e3a8a',
  },
  field: {
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '15px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    minHeight: '260px',
    padding: '12px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '15px',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px',
  },
  message: {
    marginTop: '6px',
    marginBottom: '12px',
    fontSize: '13px',
    color: '#b91c1c',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '8px 10px',
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
    padding: '12px 18px',
    background: '#fff1f2',
    color: '#b91c1c',
    border: '1px solid #fecdd3',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  hint: {
    marginTop: '14px',
    fontSize: '13px',
    color: '#6b7280',
  },
}
