export type SearchEventSource = 'enter' | 'button' | 'suggestion' | 'hot' | 'recent' | 'fallback'

export type SearchEventRecord = {
  keyword: string
  source: SearchEventSource
  hasSuggestionMatch: boolean
  createdAt: string
}

export type SearchAnalyticsSummary = {
  totalSearches: number
  noMatchSearches: number
  noMatchRate: number
  topKeywords: Array<{ keyword: string; count: number }>
}

export const SEARCH_ANALYTICS_KEY = 'travel-ai:search-events'

export function recordSearchEvent(record: SearchEventRecord) {
  if (typeof window === 'undefined') {
    return
  }

  let events: SearchEventRecord[] = []

  try {
    const text = window.localStorage.getItem(SEARCH_ANALYTICS_KEY)
    if (text) {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        events = parsed.filter((item): item is SearchEventRecord => {
          return (
            typeof item === 'object' &&
            item !== null &&
            typeof item.keyword === 'string' &&
            typeof item.source === 'string' &&
            typeof item.hasSuggestionMatch === 'boolean' &&
            typeof item.createdAt === 'string'
          )
        })
      }
    }
  } catch {
    events = []
  }

  events.unshift(record)
  const kept = events.slice(0, 300)
  window.localStorage.setItem(SEARCH_ANALYTICS_KEY, JSON.stringify(kept))
}

export function loadSearchAnalyticsSummary(): SearchAnalyticsSummary {
  if (typeof window === 'undefined') {
    return {
      totalSearches: 0,
      noMatchSearches: 0,
      noMatchRate: 0,
      topKeywords: [],
    }
  }

  let events: SearchEventRecord[] = []

  try {
    const text = window.localStorage.getItem(SEARCH_ANALYTICS_KEY)
    if (text) {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        events = parsed.filter((item): item is SearchEventRecord => {
          return (
            typeof item === 'object' &&
            item !== null &&
            typeof item.keyword === 'string' &&
            typeof item.source === 'string' &&
            typeof item.hasSuggestionMatch === 'boolean' &&
            typeof item.createdAt === 'string'
          )
        })
      }
    }
  } catch {
    events = []
  }

  const totalSearches = events.length
  const noMatchSearches = events.filter(item => !item.hasSuggestionMatch).length
  const noMatchRate = totalSearches > 0 ? Number(((noMatchSearches / totalSearches) * 100).toFixed(1)) : 0

  const counter = new Map<string, number>()
  for (const event of events) {
    const key = event.keyword.trim() || '__all__'
    counter.set(key, (counter.get(key) ?? 0) + 1)
  }

  const topKeywords = [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([keyword, count]) => ({ keyword, count }))

  return {
    totalSearches,
    noMatchSearches,
    noMatchRate,
    topKeywords,
  }
}
