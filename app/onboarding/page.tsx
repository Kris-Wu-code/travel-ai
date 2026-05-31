'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import LoginPromptModal from '../components/login-prompt-modal'

const TRAVEL_STYLES = [
  { id: 'culture', label: '文化历史', icon: '🏛️' },
  { id: 'nature', label: '自然风光', icon: '🏔️' },
  { id: 'food', label: '美食之旅', icon: '🍜' },
  { id: 'city', label: '都市探索', icon: '🏙️' },
  { id: 'relax', label: '休闲度假', icon: '🏖️' },
  { id: 'adventure', label: '户外探险', icon: '🧗' },
  { id: 'shopping', label: '购物之旅', icon: '🛍️' },
  { id: 'photo', label: '摄影打卡', icon: '📸' },
  { id: 'family_fun', label: '亲子乐园', icon: '🎠' },
  { id: 'nightlife', label: '夜生活', icon: '🌃' },
]

const BUDGET_LEVELS = [
  { id: 1, label: '经济实惠', desc: '人均每天 < 150 元', icon: '💰' },
  { id: 2, label: '舒适出行', desc: '人均每天 150-500 元', icon: '💰💰' },
  { id: 3, label: '品质享受', desc: '人均每天 > 500 元', icon: '💰💰💰' },
]

const GROUP_TYPES = [
  { id: 'solo', label: '独自旅行', icon: '🧍', desc: '一人一包，说走就走' },
  { id: 'couple', label: '情侣出游', icon: '👫', desc: '甜蜜时光' },
  { id: 'family', label: '家庭出游', icon: '👨‍👩‍👧', desc: '老少皆宜的路线' },
  { id: 'group', label: '朋友结伴', icon: '👥', desc: '热闹好玩' },
]

const TRAVEL_PACE = [
  { id: 'slow', label: '轻松慢游', icon: '🚶', desc: '睡到自然醒，一天 2-3 个点，重在体验' },
  { id: 'moderate', label: '适度节奏', icon: '🚲', desc: '半天打卡半天闲逛，经典+自由搭配' },
  { id: 'packed', label: '紧凑充实', icon: '🏃', desc: '早起晚归，尽可能多看多玩' },
]

const TABOOS = [
  { id: 'no_spicy', label: '不吃辣' },
  { id: 'no_seafood', label: '不吃海鲜' },
  { id: 'no_pork', label: '不吃猪肉' },
  { id: 'no_beef', label: '不吃牛肉' },
  { id: 'no_meat', label: '素食者' },
  { id: 'no_climb', label: '避免爬山' },
  { id: 'no_crowd', label: '避开人多' },
  { id: 'no_night', label: '不喜夜行' },
  { id: 'no_altitude', label: '怕高原反应' },
  { id: 'no_heat', label: '怕热/怕晒' },
]

const TOTAL_STEPS = 5
const DRAFT_KEY = 'travel-ai:onboarding-draft'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [loginNextUrl, setLoginNextUrl] = useState('/auth/login?next=%2Fonboarding')
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [budgetLevel, setBudgetLevel] = useState<number | null>(null)
  const [groupType, setGroupType] = useState<string | null>(null)
  const [travelPace, setTravelPace] = useState<string | null>(null)
  const [selectedTaboos, setSelectedTaboos] = useState<string[]>([])

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => {
      const user = res?.data?.user
      setUserId(user?.id ?? null)
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const draftText = window.sessionStorage.getItem(DRAFT_KEY)
    if (!draftText) return

    try {
      const draft = JSON.parse(draftText) as {
        selectedStyles?: string[]
        budgetLevel?: number | null
        groupType?: string | null
        travelPace?: string | null
        selectedTaboos?: string[]
        step?: number
      }

      setSelectedStyles(Array.isArray(draft.selectedStyles) ? draft.selectedStyles : [])
      setBudgetLevel(typeof draft.budgetLevel === 'number' ? draft.budgetLevel : null)
      setGroupType(typeof draft.groupType === 'string' ? draft.groupType : null)
      setTravelPace(typeof draft.travelPace === 'string' ? draft.travelPace : null)
      setSelectedTaboos(Array.isArray(draft.selectedTaboos) ? draft.selectedTaboos : [])
      if (typeof draft.step === 'number' && draft.step >= 1 && draft.step <= TOTAL_STEPS) {
        setStep(draft.step)
      }
      window.sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      window.sessionStorage.removeItem(DRAFT_KEY)
    }
  }, [])

  function toggleStyle(id: string) {
    setSelectedStyles(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]))
  }

  function toggleTaboo(id: string) {
    setSelectedTaboos(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]))
  }

  function canProceed() {
    if (step === 1) return selectedStyles.length > 0
    if (step === 2) return budgetLevel !== null
    if (step === 3) return groupType !== null
    if (step === 4) return travelPace !== null
    return true
  }

  function getStepTitle() {
    if (step === 1) return '你偏好的旅行风格是？'
    if (step === 2) return '你的旅行预算范围？'
    if (step === 3) return '你通常和谁一起旅行？'
    if (step === 4) return '你喜欢什么样的旅行节奏？'
    return '有哪些需要我们避开的偏好？'
  }

  function getStepHint() {
    if (step === 1) return '可多选，至少选择 1 项'
    if (step === 2) return '选择最符合的一项'
    if (step === 3) return '这将影响我们推荐路线和活动类型'
    if (step === 4) return '影响每日行程的密度和安排方式'
    return '可多选，也可以跳过'
  }

  function saveDraft() {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ selectedStyles, budgetLevel, groupType, travelPace, selectedTaboos, step }),
    )
  }

  async function handleSkip() {
    setSkipping(true)
    saveDraft()

    if (!userId) {
      router.push('/')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          travel_style: selectedStyles.length > 0 ? selectedStyles : null,
          budget_level: budgetLevel,
          group_type: groupType,
          preferences: { taboos: selectedTaboos.length > 0 ? selectedTaboos : null },
          questionnaire_done: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (!error && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(DRAFT_KEY)
    }
    router.push('/')
  }

  async function handleSubmit() {
    if (!userId) {
      saveDraft()
      setMessage('登录后可保存你的问卷偏好，我们会保留当前填写内容。')
      setLoginNextUrl('/auth/login?next=%2Fonboarding')
      setLoginPromptOpen(true)
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          travel_style: selectedStyles,
          budget_level: budgetLevel,
          group_type: groupType,
          preferences: { taboos: selectedTaboos, travel_pace: travelPace },
          questionnaire_done: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    setLoading(false)

    if (error) {
      setMessage('保存失败：' + error.message)
      return
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(DRAFT_KEY)
    }

    router.push('/')
  }

  return (
    <div className="onboard-shell">
      <aside className="onboard-side">
        <div className="brand-badge">TRAVEL AI</div>
        <h1>完善你的旅行画像</h1>
        <p>{TOTAL_STEPS} 步问卷，让推荐更懂你。</p>
        <div className="onboard-step-list" aria-label="问卷步骤">
          {[
            { n: 1, label: '旅行风格' },
            { n: 2, label: '预算范围' },
            { n: 3, label: '出行人群' },
            { n: 4, label: '旅行节奏' },
            { n: 5, label: '禁忌偏好' },
          ].map(({ n, label }) => (
            <div key={n} className={step === n ? 'onboard-step active' : 'onboard-step'}>
              <span>步骤 {n}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSkip}
          disabled={skipping}
          className="onboard-skip-all-btn"
        >
          {skipping ? '跳过中...' : '跳过问卷，以后再说'}
        </button>
      </aside>

      <main className="onboard-main">
        <div className="onboard-card">
          <div className="onboard-progress-wrap">
            <div className="onboard-progress-row" aria-hidden="true">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={i < step ? 'onboard-progress-dot active' : 'onboard-progress-dot'}
                />
              ))}
            </div>
            <p className="onboard-step-label">第 {step} 步 / 共 {TOTAL_STEPS} 步</p>
          </div>

          <h2 className="onboard-question">{getStepTitle()}</h2>
          <p className="onboard-hint">{getStepHint()}</p>

          {step === 1 && (
            <div className="onboard-grid">
              {TRAVEL_STYLES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={selectedStyles.includes(item.id) ? 'onboard-option selected' : 'onboard-option'}
                  onClick={() => toggleStyle(item.id)}
                >
                  <span className="onboard-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="onboard-budget-list">
              {BUDGET_LEVELS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={budgetLevel === item.id ? 'onboard-budget selected' : 'onboard-budget'}
                  onClick={() => setBudgetLevel(item.id)}
                >
                  <div>
                    <div className="onboard-budget-title">{item.label}</div>
                    <div className="onboard-budget-desc">{item.desc}</div>
                  </div>
                  <span>{item.icon}</span>
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="onboard-grid">
              {GROUP_TYPES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={groupType === item.id ? 'onboard-option selected' : 'onboard-option'}
                  onClick={() => setGroupType(item.id)}
                >
                  <span className="onboard-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  <small style={{ display: 'block', fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    {item.desc}
                  </small>
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="onboard-budget-list">
              {TRAVEL_PACE.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={travelPace === item.id ? 'onboard-budget selected' : 'onboard-budget'}
                  onClick={() => setTravelPace(item.id)}
                >
                  <div>
                    <div className="onboard-budget-title">{item.icon} {item.label}</div>
                    <div className="onboard-budget-desc">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="onboard-grid">
              {TABOOS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={selectedTaboos.includes(item.id) ? 'onboard-option selected compact' : 'onboard-option compact'}
                  onClick={() => toggleTaboo(item.id)}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {message ? <div className="onboard-message">{message}</div> : null}

          <LoginPromptModal
            open={loginPromptOpen}
            title="登录后可保存问卷偏好"
            description="我们会保留你当前填写的内容，登录后自动回到问卷页继续完成。"
            confirmLabel="去登录"
            cancelLabel="先看看"
            onCancel={() => setLoginPromptOpen(false)}
            onConfirm={() => router.push(loginNextUrl)}
          />

          <div className="onboard-btn-row">
            {step > 1 ? (
              <button
                type="button"
                className="onboard-back-btn"
                onClick={() => setStep(current => current - 1)}
              >
                上一步
              </button>
            ) : null}

            <button
              type="button"
              className="onboard-skip-btn"
              onClick={handleSkip}
              disabled={skipping}
            >
              跳过
            </button>

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                className="onboard-next-btn"
                style={{ opacity: canProceed() ? 1 : 0.4, cursor: canProceed() ? 'pointer' : 'not-allowed' }}
                onClick={() => (canProceed() ? setStep(current => current + 1) : null)}
              >
                下一步
              </button>
            ) : (
              <button
                type="button"
                className="onboard-next-btn"
                style={{ opacity: loading ? 0.7 : 1 }}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? '保存中...' : '完成，开始旅行'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
