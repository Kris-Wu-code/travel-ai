export type PoiDomain = 'building' | 'facility'

export type IconMeta = {
  color: string
  label: string
}

export type LegendItem = {
  key: string
  domain: PoiDomain
  label: string
}

export const LEGEND_ITEMS: LegendItem[] = [
  { key: '教学楼', domain: 'building', label: '教学楼' },
  { key: '宿舍', domain: 'building', label: '宿舍' },
  { key: '办公', domain: 'building', label: '办公' },
  { key: '图书馆', domain: 'building', label: '图书馆' },
  { key: '景点', domain: 'building', label: '景点' },
  { key: '洗手间', domain: 'facility', label: '洗手间' },
  { key: '食堂', domain: 'facility', label: '食堂' },
  { key: '咖啡', domain: 'facility', label: '咖啡' },
  { key: '超市', domain: 'facility', label: '超市' },
  { key: '停车', domain: 'facility', label: '停车' },
]

export function createLegendVisibility() {
  const visibility: Record<string, boolean> = {}
  for (const item of LEGEND_ITEMS) {
    visibility[item.key] = true
  }
  return visibility
}

export function classifyLegendKey(category: string | undefined, domain: PoiDomain): string {
  const key = (category || '').toLowerCase()

  if (domain === 'building') {
    if (key.includes('教学') || key.includes('教学楼') || key.includes('school')) return '教学楼'
    if (key.includes('宿舍') || key.includes('dorm')) return '宿舍'
    if (key.includes('办公') || key.includes('office')) return '办公'
    if (key.includes('图书馆') || key.includes('library')) return '图书馆'
    if (key.includes('景点') || key.includes('景区') || key.includes('attraction')) return '景点'
    return '其他'
  }

  if (key.includes('洗手间') || key.includes('toilet') || key.includes('wc')) return '洗手间'
  if (key.includes('食堂') || key.includes('canteen') || key.includes('饭店') || key.includes('restaurant')) return '食堂'
  if (key.includes('咖啡') || key.includes('cafe')) return '咖啡'
  if (key.includes('超市') || key.includes('supermarket') || key.includes('convenience')) return '超市'
  if (key.includes('停车') || key.includes('parking')) return '停车'
  return '其他'
}

export function getIconMeta(category: string | undefined, domain: PoiDomain): IconMeta {
  const legendKey = classifyLegendKey(category, domain)

  if (domain === 'building') {
    if (legendKey === '教学楼') return { color: '#0ea5a3', label: '教' }
    if (legendKey === '宿舍') return { color: '#06b6d4', label: '宿' }
    if (legendKey === '办公') return { color: '#2563eb', label: '办' }
    if (legendKey === '图书馆') return { color: '#7c3aed', label: '书' }
    if (legendKey === '景点') return { color: '#f97316', label: '景' }
    return { color: '#15803d', label: '建' }
  }

  if (legendKey === '洗手间') return { color: '#6366f1', label: '卫' }
  if (legendKey === '食堂') return { color: '#ea580c', label: '食' }
  if (legendKey === '咖啡') return { color: '#d97706', label: '咖' }
  if (legendKey === '超市') return { color: '#84cc16', label: '超' }
  if (legendKey === '停车') return { color: '#64748b', label: '车' }
  return { color: '#ea580c', label: '施' }
}
