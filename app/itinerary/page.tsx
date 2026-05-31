'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type SlotActivity = {
  name: string
  tag: 'spot' | 'food' | 'photo'
  desc: string
  duration: string
  price?: string
}

type DaySlot = {
  time: string
  activities: SlotActivity[]
}

type DayPlan = {
  day: number
  theme: string
  transport: string
  slots: DaySlot[]
}

type ItineraryData = {
  structured: boolean
  title?: string
  tips?: string
  days?: DayPlan[]
  markdown?: string
  destination?: string
}

const TAG_CONFIG = {
  spot:   { icon: '🏛️', label: '景点', bg: '#eef2ff', color: '#4f46e5' },
  food:   { icon: '🍜', label: '美食', bg: '#fff7ed', color: '#d97706' },
  photo:  { icon: '📸', label: '打卡', bg: '#fdf2f8', color: '#db2777' },
}

const TIME_COLORS: Record<string, string> = {
  '上午': '#fef3c7', '中午': '#fce7f3', '下午': '#dbeafe', '晚上': '#e0e7ff',
}

type PlaceSuggestion = {
  id: string
  name: string
  city: string
  district: string
  address: string
  latitude: number
  longitude: number
}

function ItineraryContent() {
  const searchParams = useSearchParams()
  const urlDest = searchParams.get('dest') ?? ''

  const [destination, setDestination] = useState(urlDest)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [searchingPlace, setSearchingPlace] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null)
  const [days, setDays] = useState(3)
  const [budget, setBudget] = useState<'economy' | 'comfort' | 'luxury'>('comfort')
  const [travelers, setTravelers] = useState<'solo' | 'couple' | 'family' | 'group'>('couple')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ItineraryData | null>(null)
  const [error, setError] = useState('')
  const [doneFlash, setDoneFlash] = useState(false)
  const [dayIndex, setDayIndex] = useState(0)
  const resultRef = { current: null as HTMLDivElement | null }

  const isFirstGen = !data
  const canGenerate = !!selectedPlace && destination.trim().length > 0

  // Autocomplete: search places as user types
  const searchTimerRef = { current: 0 as any }
  const handleDestinationChange = (value: string) => {
    setDestination(value)
    setSelectedPlace(null) // Clear selection when typing
    if (!value.trim()) { setSuggestions([]); setSuggestionsOpen(false); return }

    // Debounce 300ms
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      setSearchingPlace(true)
      try {
        const params = new URLSearchParams({ q: value.trim() })
        const res = await fetch(`/api/real-world-poi-search?${params}`)
        const data = await res.json()
        if (res.ok && Array.isArray(data.pois)) {
          setSuggestions(data.pois.slice(0, 8).map((p: any) => ({
            id: p.id, name: p.name, city: p.city, district: p.district,
            address: p.address, latitude: p.latitude, longitude: p.longitude,
          })))
          setSuggestionsOpen(true)
        }
      } catch {} finally { setSearchingPlace(false) }
    }, 300)
  }

  const handleSelectPlace = (place: PlaceSuggestion) => {
    setDestination(place.name)
    setSelectedPlace(place)
    setSuggestions([])
    setSuggestionsOpen(false)
  }

  const handleGenerate = async () => {
    if (!destination.trim()) { setError('请输入目的地'); return }
    setLoading(true); setError(''); setDoneFlash(false)
    if (!data) setData(null) // Only clear on first generation

    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', onBeforeUnload)

    try {
      const response = await fetch('/api/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: destination.trim(), days, budget, travelers }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || '行程生成失败')
      setData(json)
      setDayIndex(0)
      setDoneFlash(true)
      setTimeout(() => setDoneFlash(false), 3000)
      // Save to history (fire-and-forget)
      fetch('/api/save-itinerary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: destination.trim(), days, budget, travelers, content: json }),
      }).catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : '行程生成失败，请稍后重试')
      if (!data) setData(null)
    } finally {
      setLoading(false)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }

  const hasResult = data?.structured && Array.isArray(data.days)

  return (
    <div style={hasResult ? s.splitLayout : s.wrap}>
      {/* Left panel: form */}
      <div style={hasResult ? s.leftPanel : undefined}>
        {urlDest ? (
          <div style={s.contextBanner}>
            📍 从 <strong>{urlDest}</strong> 进入，AI 将围绕此目的地规划行程
          </div>
        ) : null}

        {!hasResult ? (
          <div style={s.heroCard}>
            <div style={s.heroIcon}>✈️</div>
            <h2 style={s.heroTitle}>AI 智能行程规划</h2>
            <p style={s.heroDesc}>告诉我目的地和偏好，AI 为你生成带交通、打卡点和时间建议的详细行程</p>
          </div>
        ) : null}

        <div style={s.formCard}>
          {hasResult ? (
            <div style={s.formCompactTitle}>调整参数</div>
          ) : null}
          <div style={s.field}>
            <label style={s.label}>目的地</label>
            <div style={{ position: 'relative' }}>
              <input style={s.input} value={destination}
                onChange={e => handleDestinationChange(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setSuggestionsOpen(true) }}
                onBlur={() => setTimeout(() => setSuggestionsOpen(false), 200)}
                onKeyDown={e => { if (e.key === 'Enter' && canGenerate) handleGenerate() }}
                placeholder="输入关键词搜索真实地点..."
              />
              {searchingPlace ? (
                <div style={s.searchSpinner}><div style={s.loadingSpinnerSmall} /></div>
              ) : null}
              {suggestionsOpen && suggestions.length > 0 ? (
                <div style={s.suggestionsDropdown}>
                  {suggestions.map(place => (
                    <button key={place.id} type="button" style={s.suggestionItem}
                      onMouseDown={() => handleSelectPlace(place)}>
                      <div style={s.suggestionName}>{place.name}</div>
                      <div style={s.suggestionMeta}>{place.city} · {place.district || place.address}</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={s.hintArea}>
              {selectedPlace ? (
                <span style={s.selectedHint}>✅ 已选中真实地点：{selectedPlace.city} · {selectedPlace.address}</span>
              ) : destination.trim() && !searchingPlace && suggestions.length === 0 ? (
                <span style={s.warningHint}>⚠️ 未找到匹配的的真实地点，请更换关键词重试</span>
              ) : destination.trim() && !searchingPlace ? (
                <span style={s.warningHint}>⚠️ 请从下拉列表中选择一个地点后才能生成行程</span>
              ) : <span style={s.hintPlaceholder}>&nbsp;</span>}
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>旅行天数</label>
            <div style={s.chipRow}>
              {[1, 2, 3, 5, 7, 10].map(n => (
                <button key={n} type="button" onClick={() => setDays(n)}
                  style={days === n ? s.chipActive : s.chip}>{n} 天</button>
              ))}
              <input style={s.dayInput} type="number" min={1} max={14} value={days}
                onChange={e => setDays(Math.max(1, Math.min(14, Number(e.target.value) || 1)))} placeholder="自定义" />
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>预算水平</label>
            <div style={s.chipRow}>
              {[
                { key: 'economy' as const, label: '💰 经济实惠', desc: '青旅+公交+小吃' },
                { key: 'comfort' as const, label: '💎 舒适出行', desc: '酒店+打车+餐厅' },
                { key: 'luxury' as const, label: '👑 品质享受', desc: '五星+包车+私厨' },
              ].map(opt => (
                <button key={opt.key} type="button" onClick={() => setBudget(opt.key)}
                  style={budget === opt.key ? s.optionActive : s.option}>
                  <div style={s.optionLabel}>{opt.label}</div>
                  <div style={s.optionDesc}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>出行人群</label>
            <div style={s.chipRow}>
              {[
                { key: 'solo' as const, label: '🧍 独自', desc: '一人自由行' },
                { key: 'couple' as const, label: '👫 情侣', desc: '浪漫双人游' },
                { key: 'family' as const, label: '👨‍👩‍👧 家庭', desc: '亲子全家游' },
                { key: 'group' as const, label: '👥 朋友', desc: '结伴一起玩' },
              ].map(opt => (
                <button key={opt.key} type="button" onClick={() => setTravelers(opt.key)}
                  style={travelers === opt.key ? s.chipSmActive : s.chipSm}>
                  <div style={s.optionLabel}>{opt.label}</div>
                  <div style={s.optionDesc}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Loading: show above button so user sees it immediately */}
          {loading ? (
            <div style={s.loadingInline}>
              <div style={s.loadingSpinnerSmall} />
              <span>{hasResult ? 'AI 正在重新规划...' : 'AI 正在规划中，预计 10-30 秒...'}</span>
            </div>
          ) : null}

          <button style={loading ? s.btnLoading : !canGenerate ? s.btnDisabled : s.btn}
            onClick={handleGenerate} disabled={loading || !canGenerate}>
            {loading ? '⏳ AI 正在规划中...'
              : !canGenerate && destination.trim() ? '🪄 请先选择匹配的地点'
              : hasResult ? '🔄 重新生成'
              : '🪄 生成行程'}
          </button>
        </div>

        {error ? (
          <div style={s.errorCard}>
            <div style={s.errorTitle}>生成失败</div>
            <div style={s.errorText}>{error}</div>
            {error.includes('未配置') ? (
              <div style={s.configHint}>
                请在 <code style={s.code}>.env.local</code> 中添加：<br />
                <code style={s.code}>OPENAI_API_KEY=sk-your-key</code>
              </div>
            ) : null}
          </div>
        ) : null}

        {!data && !error ? (
          <div style={styles.tipCard}>
            <div style={styles.tipIcon}>💡</div>
            <div style={styles.tipText}>AI 会根据目的地、天数、预算和出行人群，自动生成每日行程卡片，包括交通方式、打卡点和美食推荐。</div>
          </div>
        ) : null}
      </div>

      {/* Right panel: results */}
      {hasResult ? (
        <div style={s.rightPanel} ref={el => { resultRef.current = el }}>
          {loading ? (
            <div style={s.regenOverlay}>
              <div style={s.regenCard}>
                <div style={s.loadingSpinner} />
                <div style={s.regenTitle}>正在重新规划...</div>
                <div style={s.regenHint}>新行程即将生成，请稍候</div>
              </div>
            </div>
          ) : null}

          <div style={loading ? s.blurred : undefined}>
            {doneFlash ? <div style={s.doneBanner}>✅ 已更新</div> : null}

          <div style={s.resultTitle}>{data.title}</div>

          <div style={s.dayTabs}>
            <button onClick={() => setDayIndex(prev => Math.max(0, prev - 1))} disabled={dayIndex === 0} style={s.dayTabArrow}>◀</button>
            {data.days!.map((_, i) => (
              <button key={i} onClick={() => setDayIndex(i)} style={i === dayIndex ? s.dayTabActive : s.dayTab}>第{i + 1}天</button>
            ))}
            <button onClick={() => setDayIndex(prev => Math.min(data.days!.length - 1, prev + 1))} disabled={dayIndex >= data.days!.length - 1} style={s.dayTabArrow}>▶</button>
          </div>

          {(() => {
            const day = data.days![dayIndex]
            return (
              <div style={s.dayCard}>
                <div style={s.dayHeader}>
                  <span style={s.dayBadge}>第 {day.day} 天</span>
                  <span style={s.dayTheme}>{day.theme}</span>
                </div>
                <span style={s.dayTransport}>{day.transport}</span>

                <div style={s.slotsWrap}>
                  {day.slots.map((slot, si) => (
                    <div key={si} style={{ ...s.slotBlock, background: TIME_COLORS[slot.time] || '#f9fafb' }}>
                      <div style={s.slotTime}>{slot.time}</div>
                      <div style={s.slotActivities}>
                        {slot.activities.map((act, ai) => {
                          const cfg = TAG_CONFIG[act.tag] || TAG_CONFIG.spot
                          return (
                            <div key={ai} style={s.activity}>
                              <div style={s.actHeader}>
                                <span style={{ ...s.tagBadge, background: cfg.bg, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
                                <span style={s.actName}>{act.name}</span>
                              </div>
                              <div style={s.actDesc}>{act.desc}</div>
                              <div style={s.actMeta}>
                                <span>⏱️ {act.duration}</span>
                                {act.price ? <span>💰 {act.price}</span> : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          <div style={s.pageNav}>
            <button onClick={() => setDayIndex(prev => Math.max(0, prev - 1))} disabled={dayIndex === 0} style={s.pageNavBtn}>← 前一天</button>
            <span style={s.pageNavInfo}>{dayIndex + 1} / {data.days!.length}</span>
            <button onClick={() => setDayIndex(prev => Math.min(data.days!.length - 1, prev + 1))} disabled={dayIndex >= data.days!.length - 1} style={s.pageNavBtn}>后一天 →</button>
          </div>

          {data.tips ? (
            <div style={s.tipsCard}>
              <div style={s.tipsTitle}>💡 实用贴士</div>
              <div style={s.tipsText}>{data.tips}</div>
            </div>
          ) : null}
          </div>
        </div>
      ) : null}

      {/* Markdown fallback */}
      {data && (!data.structured || !Array.isArray(data.days)) && data.markdown ? (
        <div style={s.resultCard} ref={el => { resultRef.current = el }}>
          <div style={s.markdown}
            dangerouslySetInnerHTML={{
              __html: data.markdown
                .replace(/^## (.+)$/gm, '<h2 class="it-h2">$1</h2>')
                .replace(/^### (.+)$/gm, '<h3 class="it-h3">$1</h3>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n- (.+)/g, '\n<li>$1</li>')
                .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="it-list">$1</ul>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/^(?!<[hul/])(.+)$/gm, '<p>$1</p>'),
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

export default function ItineraryPage() {
  return (
    <div className="page-shell">
      <header className="page-shell-top">
        <div className="page-shell-top-left">
          <a href="/" className="page-shell-back">← 返回</a>
          <div>
            <h1 className="page-shell-title">AI 行程生成</h1>
            <p className="page-shell-subtitle">输入目的地和偏好，AI 为你规划专属行程</p>
          </div>
        </div>
      </header>

      <main className="page-shell-content" style={{ maxWidth: '1400px' }}>
        <Suspense fallback={<div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>加载中...</div>}>
          <ItineraryContent />
        </Suspense>
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { width: '100%' },
  splitLayout: { display: 'grid', gridTemplateColumns: '400px 1fr', gap: '32px', alignItems: 'start', width: '100%' },
  leftPanel: { position: 'sticky', top: '16px' } as React.CSSProperties,
  rightPanel: { minWidth: 0, position: 'relative' } as React.CSSProperties,
  regenOverlay: {
    position: 'absolute', inset: 0, zIndex: 10,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: '80px', borderRadius: '16px',
  },
  regenCard: {
    background: 'rgba(255,255,255,0.95)', borderRadius: '16px', padding: '36px 44px',
    textAlign: 'center', boxShadow: '0 8px 32px rgba(79,70,229,0.15)',
    border: '1px solid #e0e7ff',
  },
  regenTitle: { fontSize: '16px', fontWeight: 700, color: '#111827', marginTop: '14px' },
  regenHint: { fontSize: '13px', color: '#9ca3af', marginTop: '4px' },
  blurred: { opacity: 0.35, filter: 'blur(2px)', pointerEvents: 'none', userSelect: 'none' } as React.CSSProperties,
  formCompactTitle: { fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '14px' },
  resultTitle: { fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '14px' },
  contextBanner: {
    padding: '12px 16px', borderRadius: '12px', background: '#eef2ff', border: '1px solid #c7d2fe',
    color: '#3730a3', fontSize: '14px', marginBottom: '16px', textAlign: 'center',
  },
  heroCard: {
    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
    borderRadius: '16px', padding: '36px', textAlign: 'center', marginBottom: '20px',
  },
  heroIcon: { fontSize: '48px', marginBottom: '12px' },
  heroTitle: { fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 8px' },
  heroDesc: { fontSize: '14px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.6 },
  formCard: {
    background: '#fff', borderRadius: '16px', padding: '28px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '20px',
  },
  field: { marginBottom: '20px' },
  label: { display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '10px' },
  input: { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '15px', outline: 'none', boxSizing: 'border-box' },
  searchSpinner: { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' },
  suggestionsDropdown: { position: 'absolute', left: 0, right: 0, top: '100%', marginTop: '4px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 12px 32px rgba(0,0,0,0.12)', zIndex: 20, maxHeight: '320px', overflow: 'auto' },
  suggestionItem: { display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' },
  suggestionName: { fontSize: '14px', fontWeight: 600, color: '#111827' },
  suggestionMeta: { fontSize: '12px', color: '#6b7280', marginTop: '2px' },
  hintArea: { minHeight: '26px', display: 'flex', alignItems: 'center', marginTop: '4px' },
  hintPlaceholder: { display: 'inline-block', height: '18px' },
  selectedHint: { fontSize: '12px', color: '#059669', fontWeight: 500 },
  warningHint: { fontSize: '12px', color: '#d97706', fontWeight: 500 },
  chipRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'stretch' },
  chip: { padding: '8px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '14px', fontWeight: 500 },
  chipActive: { padding: '8px 16px', borderRadius: '10px', border: '1px solid #4f46e5', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  chipSm: { flex: '1 1 auto', minWidth: '120px', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', textAlign: 'left' },
  chipSmActive: { flex: '1 1 auto', minWidth: '120px', padding: '12px', borderRadius: '10px', border: '1px solid #4f46e5', background: '#eef2ff', cursor: 'pointer', textAlign: 'left' },
  option: { flex: '1 1 auto', minWidth: '150px', padding: '14px', borderRadius: '12px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', textAlign: 'left' },
  optionActive: { flex: '1 1 auto', minWidth: '150px', padding: '14px', borderRadius: '12px', border: '1px solid #4f46e5', background: '#eef2ff', cursor: 'pointer', textAlign: 'left' },
  optionLabel: { fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '2px' },
  optionDesc: { fontSize: '11px', color: '#6b7280' },
  dayInput: { width: '80px', padding: '8px 12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none', textAlign: 'center' },
  btn: { width: '100%', padding: '14px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' },
  btnLoading: { width: '100%', padding: '14px', background: '#818cf8', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 600, cursor: 'not-allowed' },
  btnDisabled: { width: '100%', padding: '14px', background: '#e5e7eb', color: '#9ca3af', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 600, cursor: 'not-allowed' },
  loadingOverlay: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', marginBottom: '20px' },
  loadingCardSmall: { background: '#fff', borderRadius: '14px', padding: '32px 24px', textAlign: 'center', boxShadow: '0 2px 12px rgba(79,70,229,0.08)', border: '1px solid #e0e7ff' },
  loadingInline: { padding: '14px 18px', borderRadius: '12px', background: '#eef2ff', border: '1px solid #c7d2fe', color: '#3730a3', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' },
  regenInline: { marginTop: '10px', padding: '12px 16px', borderRadius: '10px', background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4f46e5', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'center' },
  loadingSpinnerSmall: { width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #c7d2fe', borderTopColor: '#4f46e5', animation: 'spin 0.8s linear infinite', display: 'inline-block', flexShrink: 0 },
  loadingSpinner: { width: '48px', height: '48px', margin: '0 auto 20px', borderRadius: '50%', border: '4px solid #e0e7ff', borderTopColor: '#4f46e5', animation: 'spin 0.8s linear infinite' },
  loadingTitle: { fontSize: '17px', fontWeight: 700, color: '#111827', marginBottom: '8px' },
  loadingSub: { fontSize: '14px', color: '#6b7280', lineHeight: 1.6, marginBottom: '14px' },
  loadingHint: { fontSize: '12px', color: '#9ca3af', background: '#f9fafb', padding: '8px 12px', borderRadius: '8px', display: 'inline-block' },
  doneBanner: { padding: '14px 20px', borderRadius: '12px', background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#047857', fontSize: '15px', fontWeight: 600, textAlign: 'center', marginBottom: '16px' },
  errorCard: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '20px', marginBottom: '20px' },
  errorTitle: { fontSize: '15px', fontWeight: 600, color: '#991b1b', marginBottom: '6px' },
  errorText: { fontSize: '14px', color: '#b91c1c', marginBottom: '12px' },
  configHint: { fontSize: '13px', color: '#6b7280', lineHeight: 1.7, marginTop: '10px', padding: '10px', background: '#f9fafb', borderRadius: '8px' },
  code: { background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' },
  // Structured result styles
  titleBanner: { fontSize: '24px', fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: '20px' },
  dayTabs: { display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' },
  dayTab: { padding: '6px 14px', borderRadius: '999px', border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  dayTabActive: { padding: '6px 14px', borderRadius: '999px', border: '1px solid #4f46e5', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  dayTabArrow: { padding: '6px 10px', borderRadius: '999px', border: '1px solid #e5e7eb', background: '#fff', color: '#9ca3af', cursor: 'pointer', fontSize: '13px' },
  pageNav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' },
  pageNavBtn: { padding: '10px 20px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  pageNavInfo: { fontSize: '13px', color: '#9ca3af' },
  dayCard: { background: '#fff', borderRadius: '16px', padding: '24px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' },
  dayHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' },
  dayBadge: { display: 'inline-block', padding: '4px 12px', borderRadius: '999px', background: '#4f46e5', color: '#fff', fontSize: '12px', fontWeight: 700, marginRight: '10px' },
  dayTheme: { fontSize: '16px', fontWeight: 700, color: '#111827' },
  dayTransport: { fontSize: '12px', color: '#6b7280', background: '#f9fafb', padding: '4px 10px', borderRadius: '8px' },
  slotsWrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
  slotBlock: { borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px' },
  slotTime: { fontSize: '13px', fontWeight: 700, color: '#4b5563', width: '40px', flexShrink: 0, paddingTop: '2px' },
  slotActivities: { flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' },
  activity: { background: '#fff', borderRadius: '10px', padding: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  actHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  tagBadge: { padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' },
  actName: { fontSize: '14px', fontWeight: 700, color: '#111827' },
  actDesc: { fontSize: '13px', color: '#6b7280', lineHeight: 1.5, marginBottom: '6px' },
  actMeta: { display: 'flex', gap: '14px', fontSize: '12px', color: '#9ca3af' },
  tipsCard: { background: '#fffbeb', borderRadius: '16px', padding: '20px', marginTop: '8px', border: '1px solid #fde68a' },
  tipsTitle: { fontSize: '15px', fontWeight: 700, color: '#92400e', marginBottom: '8px' },
  tipsText: { fontSize: '14px', color: '#78350f', lineHeight: 1.7 },
  // Markdown fallback
  resultCard: { background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  markdown: { fontSize: '15px', lineHeight: 1.8, color: '#374151' },
}

const styles = {
  tipCard: { background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', gap: '14px', alignItems: 'flex-start' } as React.CSSProperties,
  tipIcon: { fontSize: '24px', flexShrink: 0 },
  tipText: { fontSize: '14px', color: '#6b7280', lineHeight: 1.7 },
}
