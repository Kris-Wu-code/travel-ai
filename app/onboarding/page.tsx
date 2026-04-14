'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import LoginPromptModal from '../components/login-prompt-modal'

// 问卷选项定义
const TRAVEL_STYLES = [
  { id: 'culture',   label: '文化历史', icon: '🏛️' },
  { id: 'nature',    label: '自然风光', icon: '🏔️' },
  { id: 'food',      label: '美食之旅', icon: '🍜' },
  { id: 'city',      label: '都市探索', icon: '🏙️' },
  { id: 'relax',     label: '休闲度假', icon: '🏖️' },
  { id: 'adventure', label: '户外探险', icon: '🧗' },
]

const BUDGET_LEVELS = [
  { id: 1, label: '经济实惠', desc: '人均每天 < 150元', icon: '💰' },
  { id: 2, label: '舒适出行', desc: '人均每天 150-300元', icon: '💰💰' },
  { id: 3, label: '品质享受', desc: '人均每天 > 300元', icon: '💰💰💰' },
]

const GROUP_TYPES = [
  { id: 'solo',   label: '独自旅行', icon: '🧍' },
  { id: 'couple', label: '情侣出游', icon: '👫' },
  { id: 'family', label: '家庭出游', icon: '👨‍👩‍👧' },
  { id: 'group',  label: '朋友结伴', icon: '👥' },
]

const TABOOS = [
  { id: 'no_spicy',    label: '不吃辣' },
  { id: 'no_seafood',  label: '不吃海鲜' },
  { id: 'no_pork',     label: '不吃猪肉' },
  { id: 'no_climb',    label: '避免爬山' },
  { id: 'no_crowd',    label: '避开人多' },
  { id: 'no_night',    label: '不喜夜行' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [loginNextUrl, setLoginNextUrl] = useState('/auth/login?next=%2Fonboarding')

  // 问卷答案
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [budgetLevel, setBudgetLevel] = useState<number | null>(null)
  const [groupType, setGroupType] = useState<string | null>(null)
  const [selectedTaboos, setSelectedTaboos] = useState<string[]>([])

  const TOTAL_STEPS = 4
  const DRAFT_KEY = 'travel-ai:onboarding-draft'

  // 获取当前登录用户
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
    })
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const draftText = window.sessionStorage.getItem(DRAFT_KEY)
    if (!draftText) {
      return
    }

    try {
      const draft = JSON.parse(draftText) as {
        selectedStyles?: string[]
        budgetLevel?: number | null
        groupType?: string | null
        selectedTaboos?: string[]
        step?: number
      }

      setSelectedStyles(Array.isArray(draft.selectedStyles) ? draft.selectedStyles : [])
      setBudgetLevel(typeof draft.budgetLevel === 'number' ? draft.budgetLevel : null)
      setGroupType(typeof draft.groupType === 'string' ? draft.groupType : null)
      setSelectedTaboos(Array.isArray(draft.selectedTaboos) ? draft.selectedTaboos : [])
      if (typeof draft.step === 'number' && draft.step >= 1 && draft.step <= TOTAL_STEPS) {
        setStep(draft.step)
      }
      window.sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      window.sessionStorage.removeItem(DRAFT_KEY)
    }
  }, [])

  // 多选切换
  function toggleStyle(id: string) {
    setSelectedStyles(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }
  function toggleTaboo(id: string) {
    setSelectedTaboos(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  // 提交问卷
  async function handleSubmit() {
    if (!userId) {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            selectedStyles,
            budgetLevel,
            groupType,
            selectedTaboos,
            step,
          }),
        )
      }

      setMessage('登录后可保存你的问卷偏好，我们会保留当前填写内容。')
      setLoginNextUrl('/auth/login?next=%2Fonboarding')
      setLoginPromptOpen(true)
      return
    }
    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: userId,
        travel_style: selectedStyles,
        budget_level: budgetLevel,
        group_type: groupType,
        preferences: { taboos: selectedTaboos },
        questionnaire_done: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    setLoading(false)

    if (error) {
      setMessage('保存失败：' + error.message)
      return
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(DRAFT_KEY)
    }

    router.push('/dashboard')
  }

  // 判断当前步骤是否可以继续
  function canProceed() {
    if (step === 1) return selectedStyles.length > 0
    if (step === 2) return budgetLevel !== null
    if (step === 3) return groupType !== null
    return true // 第4步（禁忌）可以跳过
  }

  return (
    <div style={s.container}>
      <div style={s.card}>

        {/* 顶部进度条 */}
        <div style={s.progressWrap}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{
              ...s.progressDot,
              background: i < step ? '#4f46e5' : '#e5e7eb',
              transform: i + 1 === step ? 'scale(1.2)' : 'scale(1)',
            }} />
          ))}
        </div>
        <p style={s.stepLabel}>第 {step} 步 / 共 {TOTAL_STEPS} 步</p>

        {/* ── 步骤1：旅行风格 ── */}
        {step === 1 && (
          <div>
            <h2 style={s.question}>你喜欢哪种旅行风格？</h2>
            <p style={s.hint}>可多选，至少选一个</p>
            <div style={s.grid}>
              {TRAVEL_STYLES.map(item => (
                <div
                  key={item.id}
                  style={{
                    ...s.optionCard,
                    borderColor: selectedStyles.includes(item.id) ? '#4f46e5' : '#e5e7eb',
                    background: selectedStyles.includes(item.id) ? '#eef2ff' : '#fff',
                  }}
                  onClick={() => toggleStyle(item.id)}
                >
                  <span style={{ fontSize: '28px' }}>{item.icon}</span>
                  <span style={s.optionLabel}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 步骤2：预算 ── */}
        {step === 2 && (
          <div>
            <h2 style={s.question}>你的旅行预算是？</h2>
            <p style={s.hint}>选择最符合的一项</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {BUDGET_LEVELS.map(item => (
                <div
                  key={item.id}
                  style={{
                    ...s.budgetCard,
                    borderColor: budgetLevel === item.id ? '#4f46e5' : '#e5e7eb',
                    background: budgetLevel === item.id ? '#eef2ff' : '#fff',
                  }}
                  onClick={() => setBudgetLevel(item.id)}
                >
                  <div>
                    <div style={s.budgetLabel}>{item.label}</div>
                    <div style={s.budgetDesc}>{item.desc}</div>
                  </div>
                  <span style={{ fontSize: '20px' }}>{item.icon}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 步骤3：出行人群 ── */}
        {step === 3 && (
          <div>
            <h2 style={s.question}>你通常和谁一起旅行？</h2>
            <p style={s.hint}>选择最符合的一项</p>
            <div style={s.grid}>
              {GROUP_TYPES.map(item => (
                <div
                  key={item.id}
                  style={{
                    ...s.optionCard,
                    borderColor: groupType === item.id ? '#4f46e5' : '#e5e7eb',
                    background: groupType === item.id ? '#eef2ff' : '#fff',
                  }}
                  onClick={() => setGroupType(item.id)}
                >
                  <span style={{ fontSize: '28px' }}>{item.icon}</span>
                  <span style={s.optionLabel}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 步骤4：禁忌偏好 ── */}
        {step === 4 && (
          <div>
            <h2 style={s.question}>有什么需要避开的吗？</h2>
            <p style={s.hint}>可多选，也可以直接跳过</p>
            <div style={s.grid}>
              {TABOOS.map(item => (
                <div
                  key={item.id}
                  style={{
                    ...s.optionCard,
                    borderColor: selectedTaboos.includes(item.id) ? '#4f46e5' : '#e5e7eb',
                    background: selectedTaboos.includes(item.id) ? '#eef2ff' : '#fff',
                    minHeight: '60px',
                  }}
                  onClick={() => toggleTaboo(item.id)}
                >
                  <span style={s.optionLabel}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {message ? <div style={s.message}>{message}</div> : null}

        <LoginPromptModal
          open={loginPromptOpen}
          title="登录后可保存问卷偏好"
          description="我们会保留你当前填写的内容，登录后自动回到问卷页继续完成。"
          confirmLabel="去登录"
          cancelLabel="先看看"
          onCancel={() => setLoginPromptOpen(false)}
          onConfirm={() => router.push(loginNextUrl)}
        />

        {/* 底部按钮区 */}
        <div style={s.btnRow}>
          {step > 1 && (
            <button
              style={s.backBtn}
              onClick={() => setStep(s => s - 1)}
            >
              上一步
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              style={{
                ...s.nextBtn,
                opacity: canProceed() ? 1 : 0.4,
                cursor: canProceed() ? 'pointer' : 'not-allowed',
              }}
              onClick={() => canProceed() && setStep(s => s + 1)}
            >
              下一步
            </button>
          ) : (
            <button
              style={{ ...s.nextBtn, opacity: loading ? 0.7 : 1 }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '保存中...' : '完成，开始旅行 🎉'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f7fa',
    fontFamily: 'system-ui, sans-serif',
    padding: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: '20px',
    padding: '40px',
    width: '100%',
    maxWidth: '520px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  progressWrap: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
  },
  progressDot: {
    width: '32px',
    height: '6px',
    borderRadius: '3px',
    transition: 'all 0.3s',
  },
  stepLabel: {
    fontSize: '13px',
    color: '#9ca3af',
    margin: '0 0 28px',
  },
  question: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#1a1a2e',
    margin: '0 0 6px',
  },
  hint: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: '0 0 24px',
  },
  message: {
    marginBottom: '14px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    fontSize: '13px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '8px',
  },
  optionCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '20px 12px',
    borderRadius: '12px',
    border: '2px solid',
    cursor: 'pointer',
    transition: 'all 0.15s',
    minHeight: '90px',
  },
  optionLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  budgetCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderRadius: '12px',
    border: '2px solid',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  budgetLabel: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: '2px',
  },
  budgetDesc: {
    fontSize: '13px',
    color: '#9ca3af',
  },
  btnRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '32px',
  },
  backBtn: {
    flex: 1,
    padding: '13px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    background: '#fff',
    fontSize: '15px',
    fontWeight: '500',
    color: '#6b7280',
    cursor: 'pointer',
  },
  nextBtn: {
    flex: 2,
    padding: '13px',
    borderRadius: '10px',
    border: 'none',
    background: '#4f46e5',
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
    cursor: 'pointer',
  },
}