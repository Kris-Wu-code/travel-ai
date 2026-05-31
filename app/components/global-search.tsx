'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { recordSearchEvent, type SearchEventSource } from '../lib/search-analytics'

type SearchSuggestion = {
  id: string
  name: string
  city: string | null
  searchCount?: number
}

type GlobalSearchProps = {
  placeholder?: string
  buttonLabel?: string
  className?: string
}

const RECENT_KEY = 'travel-ai:recent-searches'
const HOT_KEYWORDS = ['杭州', '厦门', '重庆', '古镇', '亲子', '徒步']
const SHORTCUTS = [
  { label: '热门景区', icon: '🔥' },
  { label: '亲子游', icon: '👨‍👩‍👧‍👦' },
  { label: '登山', icon: '⛰️' },
  { label: '海边', icon: '🏖️' },
]

export default function GlobalSearch({
  placeholder = '搜索城市 / 景区 / 玩法',
  buttonLabel = '搜索',
  className,
}: GlobalSearchProps) {
  const router = useRouter()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)

  const trimmed = keyword.trim()

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const text = window.localStorage.getItem(RECENT_KEY)
      if (!text) {
        return
      }

      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        setRecent(parsed.filter((item): item is string => typeof item === 'string').slice(0, 6))
      }
    } catch {
      setRecent([])
    }
  }, [])

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!wrapRef.current) {
        return
      }

      if (!wrapRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    if (!trimmed) {
      setSuggestions([])
      return
    }

    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/search-suggestions?q=${encodeURIComponent(trimmed)}`)
        const payload = await response.json()
        setSuggestions(payload.suggestions || [])
      } catch {
        setSuggestions([])
      }
      setLoading(false)
    }, 220)

    return () => {
      window.clearTimeout(timer)
    }
  }, [open, trimmed])

  useEffect(() => {
    setActiveIndex(-1)
  }, [suggestions, trimmed, open])

  const showRecent = useMemo(() => open && !trimmed && recent.length > 0, [open, trimmed, recent.length])
  const showHotKeywords = useMemo(() => open && !trimmed, [open, trimmed])
  const showSuggestions = useMemo(() => open && !!trimmed, [open, trimmed])

  function trackSearchEvent(eventName: string, payload: Record<string, string>) {
    if (typeof window === 'undefined') {
      return
    }

    const win = window as Window & {
      dataLayer?: Array<Record<string, string>>
      gtag?: (...args: unknown[]) => void
    }

    if (Array.isArray(win.dataLayer)) {
      win.dataLayer.push({ event: eventName, ...payload })
    }

    if (typeof win.gtag === 'function') {
      win.gtag('event', eventName, payload)
    }
  }

  function sendSearchEventToServer(payload: {
    keyword: string
    source: SearchEventSource
    hasSuggestionMatch: boolean
  }) {
    if (typeof window === 'undefined') {
      return
    }

    const bodyText = JSON.stringify(payload)

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([bodyText], { type: 'application/json' })
      navigator.sendBeacon('/api/search-events', blob)
      return
    }

    void fetch('/api/search-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyText,
      keepalive: true,
    }).catch(() => {
      // best-effort analytics reporting
    })
  }

  function saveRecent(nextKeyword: string) {
    const value = nextKeyword.trim()
    if (!value || typeof window === 'undefined') {
      return
    }

    const nextRecent = [value, ...recent.filter(item => item !== value)].slice(0, 6)
    setRecent(nextRecent)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent))
  }

  function selectScene(id: string, name: string) {
    saveRecent(name)
    setOpen(false)
    router.push(`/scenes/${id}`)
  }

  function submit(nextKeyword?: string, source: SearchEventSource = 'button') {
    const value = (nextKeyword ?? keyword).trim()
    const matched = suggestions.find(item => item.name === value)
    if (matched) { selectScene(matched.id, matched.name); return }
    const hasSuggestionMatch = suggestions.some(item => item.name === value)
    saveRecent(value)
    recordSearchEvent({
      keyword: value || '__all__',
      source,
      hasSuggestionMatch,
      createdAt: new Date().toISOString(),
    })
    sendSearchEventToServer({
      keyword: value || '__all__',
      source,
      hasSuggestionMatch,
    })
    trackSearchEvent('search_submit', {
      keyword: value || '__all__',
      source,
    })
    router.push(value ? `/scenes?q=${encodeURIComponent(value)}` : '/scenes')
    setOpen(false)
  }

  function handleArrowSelection(direction: 'up' | 'down') {
    if (suggestions.length === 0) {
      return
    }

    if (direction === 'down') {
      const nextIndex = activeIndex >= suggestions.length - 1 ? 0 : activeIndex + 1
      setActiveIndex(nextIndex)
      setKeyword(suggestions[nextIndex].name)
      return
    }

    const nextIndex = activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1
    setActiveIndex(nextIndex)
    setKeyword(suggestions[nextIndex].name)
  }

  return (
    <div className={className ? `global-search ${className}` : 'global-search'} ref={wrapRef}>
      <input
        type="search"
        placeholder={placeholder}
        aria-label="搜索景区和城市"
        value={keyword}
        onFocus={() => setOpen(true)}
        onChange={event => {
          setKeyword(event.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            handleArrowSelection('down')
            return
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            handleArrowSelection('up')
            return
          }

          if (event.key === 'Escape') {
            setOpen(false)
            return
          }

          if (event.key === 'Enter') {
            if (activeIndex >= 0 && suggestions[activeIndex]) {
              selectScene(suggestions[activeIndex].id, suggestions[activeIndex].name)
              return
            }
            submit(undefined, 'enter')
          }
        }}
      />
      <button type="button" onClick={() => submit(undefined, 'button')}>{buttonLabel}</button>

      {open ? (
        <div className="global-search-dropdown">
          {showRecent ? (
            <>
              <div className="global-search-section">
                <div className="global-search-title">快捷搜索</div>
                <div className="global-search-shortcuts">
                  {SHORTCUTS.map(sc => (
                    <button
                      key={sc.label}
                      type="button"
                      className="global-search-shortcut"
                      onClick={() => submit(sc.label, 'suggestion')}
                    >
                      <span>{sc.icon}</span>
                      <span>{sc.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="global-search-section">
                <div className="global-search-title">最近搜索</div>
                <div className="global-search-tags">
                  {recent.map(item => (
                    <button key={item} type="button" className="global-search-tag" onClick={() => submit(item, 'recent')}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {showHotKeywords ? (
            <div className="global-search-section">
              <div className="global-search-title">热门搜索</div>
              <div className="global-search-tags">
                {HOT_KEYWORDS.map(item => (
                  <button key={item} type="button" className="global-search-tag hot" onClick={() => submit(item, 'hot')}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {showSuggestions ? (
            <div className="global-search-section">
              <div className="global-search-title">景区联想</div>
              {loading ? (
                <div className="global-search-empty">搜索中...</div>
              ) : suggestions.length === 0 ? (
                <div className="global-search-empty-wrap">
                  <div className="global-search-empty">没有精确匹配，试试这些推荐关键词</div>
                  <div className="global-search-tags">
                    {HOT_KEYWORDS.map(item => (
                      <button key={item} type="button" className="global-search-tag" onClick={() => submit(item, 'hot')}>
                        {item}
                      </button>
                    ))}
                    <button type="button" className="global-search-tag hot" onClick={() => submit(undefined, 'fallback')}>
                      查看全部景区
                    </button>
                  </div>
                </div>
              ) : (
                <div className="global-search-list">
                  {suggestions.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className={index === activeIndex ? 'global-search-item active' : 'global-search-item'}
                      onClick={() => selectScene(item.id, item.name)}
                    >
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <span>{item.name}</span>
                        <small>{item.city ?? '未知城市'}</small>
                      </div>
                      {item.searchCount && item.searchCount > 0 ? (
                        <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 500, marginLeft: '8px', whiteSpace: 'nowrap' }}>
                          🔥 {item.searchCount}
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {!showRecent && !showSuggestions ? (
            <div className="global-search-empty">输入关键词开始搜索</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
