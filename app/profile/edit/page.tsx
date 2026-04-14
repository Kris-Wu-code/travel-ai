'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageShell from '../../components/page-shell'
import { supabase } from '../../lib/supabase'

type EditableProfile = {
  user_id: string
  display_name: string | null
  preferences: {
    profile_intro?: string
    [key: string]: unknown
  } | null
}

export default function ProfileEditPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [displayName, setDisplayName] = useState('')
  const [intro, setIntro] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [initialDisplayName, setInitialDisplayName] = useState('')
  const [initialIntro, setInitialIntro] = useState('')
  const [initialAvatarUrl, setInitialAvatarUrl] = useState('')
  const [originPreferences, setOriginPreferences] = useState<Record<string, unknown>>({})
  const [lastFailedFile, setLastFailedFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] = useState<'error' | 'success' | 'info'>('info')

  const hasUnsavedChanges =
    displayName.trim() !== initialDisplayName.trim()
    || intro.trim() !== initialIntro.trim()
    || avatarUrl !== initialAvatarUrl

  function extractAvatarPath(url: string) {
    if (!url) {
      return null
    }

    const marker = '/avatars/'
    const markerIndex = url.indexOf(marker)
    if (markerIndex === -1) {
      return null
    }

    const rawPath = url.slice(markerIndex + marker.length).split('?')[0].trim()
    if (!rawPath) {
      return null
    }

    return decodeURIComponent(rawPath)
  }

  function fileToImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file)
      const image = new Image()
      image.onload = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(image)
      }
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('图片解析失败'))
      }
      image.src = objectUrl
    })
  }

  async function cropAndCompressAvatar(file: File): Promise<Blob> {
    const image = await fileToImage(file)
    const size = Math.min(image.width, image.height)
    const cropX = Math.floor((image.width - size) / 2)
    const cropY = Math.floor((image.height - size) / 2)

    const outputSize = 512
    const canvas = document.createElement('canvas')
    canvas.width = outputSize
    canvas.height = outputSize
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('浏览器不支持图片处理')
    }

    context.drawImage(image, cropX, cropY, size, size, 0, 0, outputSize, outputSize)

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(result => resolve(result), 'image/webp', 0.82)
    })

    if (!blob) {
      throw new Error('头像压缩失败')
    }

    return blob
  }

  useEffect(() => {
    async function loadEditableProfile() {
      setLoading(true)
      setMessage(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/auth/login')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, preferences')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        setMessage(`资料加载失败：${error.message}`)
        setLoading(false)
        return
      }

      const profile = (data ?? null) as EditableProfile | null
      const initialName = profile?.display_name ?? user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? ''
      const preferences = (profile?.preferences ?? {}) as Record<string, unknown>

      setDisplayName(initialName)
      setIntro(typeof preferences.profile_intro === 'string' ? preferences.profile_intro : '')
      setAvatarUrl(typeof preferences.profile_avatar_url === 'string' ? preferences.profile_avatar_url : typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : '')
      setInitialDisplayName(initialName)
      setInitialIntro(typeof preferences.profile_intro === 'string' ? preferences.profile_intro : '')
      setInitialAvatarUrl(typeof preferences.profile_avatar_url === 'string' ? preferences.profile_avatar_url : typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : '')
      setOriginPreferences(preferences)
      setLoading(false)
    }

    loadEditableProfile()
  }, [router])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges || saving || uploadingAvatar) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges, saving, uploadingAvatar])

  function confirmLeaveIfDirty() {
    if (!hasUnsavedChanges) {
      return true
    }

    return window.confirm('你有未保存的修改，确认离开吗？')
  }

  async function handleSave() {
    if (!displayName.trim()) {
      setMessageTone('error')
      setMessage('昵称不能为空')
      return
    }

    setSaving(true)
    setMessageTone('info')
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setSaving(false)
      setMessageTone('error')
      setMessage('登录状态失效，请重新登录后再试')
      router.push('/auth/login')
      return
    }

    const nextPreferences: Record<string, unknown> = {
      ...originPreferences,
      profile_intro: intro.trim() || null,
      profile_avatar_url: avatarUrl || null,
    }

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          display_name: displayName.trim(),
          preferences: nextPreferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (upsertError) {
      setSaving(false)
      setMessageTone('error')
      setMessage(`保存失败：${upsertError.message}`)
      return
    }

    // Keep top-right account name in sync with profile display name.
    await supabase.auth.updateUser({
      data: {
        full_name: displayName.trim(),
        avatar_url: avatarUrl || null,
      },
    })

    const savedName = displayName.trim()
    const savedIntro = intro.trim()
    const savedAvatar = avatarUrl
    setInitialDisplayName(savedName)
    setInitialIntro(savedIntro)
    setInitialAvatarUrl(savedAvatar)
    setSaving(false)
    setMessageTone('success')
    setMessage('保存成功，正在返回个人主页...')
    window.setTimeout(() => {
      router.push('/profile')
    }, 700)
  }

  async function uploadAvatarFile(file: File) {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setMessageTone('error')
      setMessage('请上传图片文件（jpg/png/webp 等）')
      return
    }

    const maxBytes = 2 * 1024 * 1024
    if (file.size > maxBytes) {
      setMessageTone('error')
      setMessage('头像图片不能超过 2MB')
      return
    }

    setUploadingAvatar(true)
    setUploadProgress(10)
    setMessage(null)
    setLastFailedFile(file)
    const previousAvatarPath = extractAvatarPath(avatarUrl)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setUploadingAvatar(false)
      setUploadProgress(0)
      setMessageTone('error')
      setMessage('登录状态失效，请重新登录后再试')
      router.push('/auth/login')
      return
    }

    setUploadProgress(35)

    let avatarBlob: Blob
    try {
      avatarBlob = await cropAndCompressAvatar(file)
    } catch (error) {
      setUploadingAvatar(false)
      setUploadProgress(0)
      setMessageTone('error')
      setMessage(error instanceof Error ? error.message : '头像处理失败，请重试')
      return
    }

    setUploadProgress(70)
    const filePath = `${user.id}/avatar-${Date.now()}.webp`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarBlob, {
        upsert: true,
        cacheControl: '3600',
        contentType: 'image/webp',
      })

    if (uploadError) {
      setUploadingAvatar(false)
      setUploadProgress(0)
      setMessageTone('error')
      setMessage(`头像上传失败：${uploadError.message}`)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)

    // Best effort: remove previous avatar object to prevent orphaned files.
    if (previousAvatarPath && previousAvatarPath !== filePath) {
      await supabase.storage.from('avatars').remove([previousAvatarPath])
    }

    setAvatarUrl(data.publicUrl)
    setUploadingAvatar(false)
    setUploadProgress(100)
    setLastFailedFile(null)
    setMessageTone('success')
    setMessage('头像上传成功，点击“保存资料”后生效')

    window.setTimeout(() => {
      setUploadProgress(0)
    }, 600)
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    await uploadAvatarFile(file as File)
    event.target.value = ''
  }

  async function handleClearAvatar() {
    if (!avatarUrl) {
      return
    }

    setUploadingAvatar(true)
    setUploadProgress(15)
    setMessage(null)

    const currentAvatarPath = extractAvatarPath(avatarUrl)
    if (currentAvatarPath) {
      const { error } = await supabase.storage.from('avatars').remove([currentAvatarPath])
      if (error) {
        setUploadingAvatar(false)
        setUploadProgress(0)
        setMessageTone('error')
        setMessage(`头像文件删除失败：${error.message}`)
        return
      }
    }

    setAvatarUrl('')
    setLastFailedFile(null)
    setUploadingAvatar(false)
    setUploadProgress(0)
    setMessageTone('info')
    setMessage('头像已清空，点击“保存资料”后生效')
  }

  return (
    <PageShell backHref="/profile" title="编辑资料" subtitle="更新昵称与个人简介" contentMaxWidth="760px">
      <div>
        {loading ? (
          <div style={styles.card}>资料加载中...</div>
        ) : (
          <div style={styles.card}>
            <div style={styles.avatarRow}>
              <div style={styles.avatarPreviewWrap}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="头像预览" style={styles.avatarPreview} />
                ) : (
                  <div style={styles.avatarFallback}>{(displayName || 'T').slice(0, 1).toUpperCase()}</div>
                )}
              </div>
              <div style={styles.avatarActions}>
                <label style={styles.uploadBtn}>
                  {uploadingAvatar ? '上传中...' : '上传头像'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    style={{ display: 'none' }}
                    disabled={uploadingAvatar || saving}
                  />
                </label>
                {uploadingAvatar || uploadProgress > 0 ? (
                  <div style={styles.progressWrap}>
                    <div style={{ ...styles.progressBar, width: `${uploadProgress}%` }} />
                  </div>
                ) : null}
                <button
                  type="button"
                  style={styles.clearBtn}
                  onClick={handleClearAvatar}
                  disabled={uploadingAvatar || saving || !avatarUrl}
                >
                  清空头像
                </button>
                {lastFailedFile && !uploadingAvatar ? (
                  <button
                    type="button"
                    style={styles.retryBtn}
                    onClick={() => uploadAvatarFile(lastFailedFile)}
                  >
                    重试上次上传
                  </button>
                ) : null}
                <div style={styles.avatarHint}>建议尺寸 400x400，大小不超过 2MB</div>
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>昵称</label>
              <input
                style={styles.input}
                value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                placeholder="例如：川西慢游者"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>个人简介</label>
              <textarea
                style={styles.textarea}
                value={intro}
                onChange={event => setIntro(event.target.value)}
                placeholder="介绍一下你的旅行风格，比如偏爱历史建筑、徒步和本地美食。"
                maxLength={180}
              />
              <div style={styles.counter}>{intro.length} / 180</div>
            </div>

            {message ? <div style={messageTone === 'success' ? styles.messageSuccess : messageTone === 'error' ? styles.messageError : styles.messageInfo}>{message}</div> : null}

            <div style={styles.actions}>
              <button style={styles.primaryBtn} onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存资料'}
              </button>
              <button
                style={styles.secondaryBtn}
                onClick={() => {
                  if (!confirmLeaveIfDirty()) {
                    return
                  }

                  router.push('/profile')
                }}
                disabled={saving}
              >
                取消
              </button>
            </div>
          </div>
        )}
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
  avatarRow: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    marginBottom: '22px',
    flexWrap: 'wrap',
  },
  avatarPreviewWrap: {
    width: '84px',
    height: '84px',
  },
  avatarPreview: {
    width: '84px',
    height: '84px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1px solid #d1d5db',
  },
  avatarFallback: {
    width: '84px',
    height: '84px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    fontWeight: 800,
  },
  avatarActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-start',
  },
  uploadBtn: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #4f46e5',
    background: '#eef2ff',
    color: '#4338ca',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  clearBtn: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  retryBtn: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #f59e0b',
    background: '#fffbeb',
    color: '#92400e',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  progressWrap: {
    width: '220px',
    height: '8px',
    borderRadius: '999px',
    background: '#e5e7eb',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: '999px',
    background: 'linear-gradient(90deg, #4f46e5, #0ea5e9)',
    transition: 'width 180ms ease',
  },
  avatarHint: {
    fontSize: '12px',
    color: '#9ca3af',
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
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    minHeight: '120px',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    boxSizing: 'border-box',
    resize: 'vertical',
    lineHeight: 1.6,
  },
  counter: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#9ca3af',
    textAlign: 'right',
  },
  messageError: {
    marginBottom: '14px',
    fontSize: '13px',
    color: '#b91c1c',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '8px 10px',
  },
  messageSuccess: {
    marginBottom: '14px',
    fontSize: '13px',
    color: '#065f46',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '8px',
    padding: '8px 10px',
  },
  messageInfo: {
    marginBottom: '14px',
    fontSize: '13px',
    color: '#1e3a8a',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    padding: '8px 10px',
  },
  actions: {
    display: 'flex',
    gap: '10px',
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
}