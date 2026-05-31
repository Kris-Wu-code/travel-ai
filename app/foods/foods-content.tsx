'use client'

import { useEffect, useMemo, useState } from 'react'
import PageShell from '../components/page-shell'

type Place = {
  id: string
  name: string
  city: string
  district: string
  address: string
  latitude: number
  longitude: number
}

type NearbyFood = {
  id: string
  name: string
  type: string
  typeCode: string
  city: string
  district: string
  address: string
  latitude: number
  longitude: number
  distance: number
  rating: string | null
  cost: string | null
  tel: string | null
}

const RADIUS_OPTIONS = [
  { value: 1000, label: '1 公里' },
  { value: 3000, label: '3 公里' },
  { value: 5000, label: '5 公里' },
  { value: 10000, label: '10 公里' },
]

export default function FoodsContent() {
  // Location search
  const [locationKeyword, setLocationKeyword] = useState('')
  const [searchingLocation, setSearchingLocation] = useState(false)
  const [placeResults, setPlaceResults] = useState<Place[]>([])
  const [locationError, setLocationError] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)

  // Food search
  const [searchRadius, setSearchRadius] = useState(3000)
  const [loadingFoods, setLoadingFoods] = useState(false)
  const [foods, setFoods] = useState<NearbyFood[]>([])
  const [foodError, setFoodError] = useState('')
  const [foodTotal, setFoodTotal] = useState(0)
  const [displayCount, setDisplayCount] = useState(25)
  const [categoryFilter, setCategoryFilter] = useState('全部')

  // Restore from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('travel-ai:food-search')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.place) setSelectedPlace(parsed.place)
        if (parsed.foods) setFoods(parsed.foods)
        if (parsed.total) setFoodTotal(parsed.total)
        if (parsed.keyword) setLocationKeyword(parsed.keyword)
      }
    } catch {
      sessionStorage.removeItem('travel-ai:food-search')
    }
  }, [])

  const canSearch = locationKeyword.trim().length > 0

  const FOOD_CATEGORIES = [
    { label: '全部', key: '全部' },
    { label: '中餐', key: '050100' },
    { label: '西餐', key: '050200' },
    { label: '快餐', key: '050300' },
    { label: '咖啡', key: '050500' },
    { label: '茶饮', key: '050600' },
    { label: '冷饮', key: '050700' },
    { label: '甜品', key: '050800' },
    { label: '其他', key: 'other' },
  ]

  const filteredFoods = categoryFilter === '全部'
    ? foods
    : categoryFilter === 'other'
      ? foods.filter(f => !FOOD_CATEGORIES.slice(1, -1).some(c => f.typeCode?.startsWith(c.key)))
      : foods.filter(f => f.typeCode?.startsWith(categoryFilter))

  const handleSearchLocation = async () => {
    if (!canSearch) {
      setLocationError('请输入地点名称，如"西湖""三里屯""故宫"')
      return
    }

    setSearchingLocation(true)
    setLocationError('')
    setPlaceResults([])

    try {
      const params = new URLSearchParams({ q: locationKeyword.trim() })
      const response = await fetch(`/api/real-world-poi-search?${params}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || data.error || '地点搜索失败')

      const places = (data.pois || []).map((poi: any) => ({
        id: poi.id,
        name: poi.name,
        city: poi.city,
        district: poi.district,
        address: poi.address,
        latitude: poi.latitude,
        longitude: poi.longitude,
      }))

      setPlaceResults(places)

      if (places.length === 0) {
        setLocationError('未找到匹配的地点，请换个关键词试试')
      }
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : '地点搜索失败')
    } finally {
      setSearchingLocation(false)
    }
  }

  const handleSelectPlace = async (place: Place) => {
    setSelectedPlace(place)
    setFoods([])
    setFoodError('')
    setDisplayCount(25)
    setCategoryFilter('全部')
    setLoadingFoods(true)

    try {
      const params = new URLSearchParams({
        lng: String(place.longitude),
        lat: String(place.latitude),
        radius: String(searchRadius),
      })
      const response = await fetch(`/api/nearby-food?${params}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || data.error || '美食搜索失败')

      setFoods(data.foods || [])
      setFoodTotal(data.total || 0)

      // Persist
      try {
        sessionStorage.setItem('travel-ai:food-search', JSON.stringify({
          place, foods: data.foods, total: data.total, keyword: locationKeyword,
        }))
      } catch {}
    } catch (err) {
      setFoodError(err instanceof Error ? err.message : '附近美食搜索失败')
    } finally {
      setLoadingFoods(false)
    }
  }

  // Re-search when radius changes
  useEffect(() => {
    if (!selectedPlace) return
    handleSelectPlace(selectedPlace)
  }, [searchRadius])

  // Reset display count when category filter changes
  useEffect(() => {
    setDisplayCount(25)
  }, [categoryFilter])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearchLocation()
  }

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters} m`
    return `${(meters / 1000).toFixed(1)} km`
  }

  const typeLabel = useMemo(() => {
    const typeMap: Record<string, string> = {
      '050000': '餐饮', '050100': '中餐', '050200': '西餐',
      '050300': '快餐', '050500': '甜品', '050800': '咖啡',
    }
    return (code: string) => typeMap[code] || code
  }, [])

  return (
    <PageShell backHref="/" title="美食推荐" subtitle="搜索地点，发现周边值得吃的地方" contentMaxWidth="860px">
      <div style={styles.wrap}>
        {/* Location search */}
        <div style={styles.searchCard}>
          <div style={styles.searchTitle}>搜索地点</div>
          <p style={styles.searchHint}>输入目的地名称，查看周边美食</p>
          <div style={styles.searchRow}>
            <input
              value={locationKeyword}
              onChange={e => setLocationKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="如：西湖、三里屯、故宫、新宿..."
              style={styles.input}
            />
            <button
              type="button"
              onClick={handleSearchLocation}
              disabled={searchingLocation || !canSearch}
              style={styles.searchBtn}
            >
              {searchingLocation ? '搜索中...' : '搜索'}
            </button>
          </div>

          {locationError ? <div style={styles.errorText}>{locationError}</div> : null}

          {/* Place results */}
          {placeResults.length > 0 ? (
            <div style={styles.placeList}>
              {placeResults.map(place => {
                const isSelected = selectedPlace?.id === place.id
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => handleSelectPlace(place)}
                    style={{
                      ...styles.placeItem,
                      borderColor: isSelected ? '#4f46e5' : '#e5e7eb',
                      background: isSelected ? '#eef2ff' : '#fff',
                    }}
                  >
                    <div style={styles.placeName}>
                      {place.name}
                      {isSelected ? <span style={styles.selectedBadge}>已选</span> : null}
                    </div>
                    <div style={styles.placeMeta}>
                      {place.city} · {place.district || place.address}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* Radius + selected place */}
        {selectedPlace ? (
          <div style={styles.activeBar}>
            <div style={styles.activePlace}>
              📍 <strong>{selectedPlace.name}</strong>
              <span style={styles.activeCity}>{selectedPlace.city} · {selectedPlace.district}</span>
            </div>
            <div style={styles.radiusRow}>
              <span style={styles.radiusLabel}>搜索范围：</span>
              {RADIUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSearchRadius(opt.value)}
                  style={searchRadius === opt.value ? styles.radiusBtnActive : styles.radiusBtn}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Category filter */}
        {selectedPlace && foods.length > 0 ? (
          <div style={styles.filterRow}>
            {FOOD_CATEGORIES.map(cat => {
              const count = cat.key === '全部'
                ? (foodTotal > 99 ? '99+' : foods.length)
                : cat.key === 'other'
                  ? foods.filter(f => !FOOD_CATEGORIES.slice(1, -1).some(c => f.typeCode?.startsWith(c.key))).length
                  : foods.filter(f => f.typeCode?.startsWith(cat.key)).length
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategoryFilter(cat.key)}
                  style={categoryFilter === cat.key ? styles.filterBtnActive : styles.filterBtn}
                >
                  {cat.label} ({count})
                </button>
              )
            })}
          </div>
        ) : null}

        {/* Food results */}
        {loadingFoods ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyIcon}>⏳</div>
            <div style={styles.emptyTitle}>正在搜索周边美食...</div>
          </div>
        ) : foodError ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyIcon}>⚠️</div>
            <div style={styles.emptyTitle}>搜索失败</div>
            <div style={styles.emptyDesc}>{foodError}</div>
          </div>
        ) : foods.length > 0 ? (
          <>
            <div style={styles.resultSummary}>
              {categoryFilter === '全部'
                ? <>找到 <strong>{foodTotal > 99 ? '99+' : foodTotal}</strong> 家美食，显示 {Math.min(displayCount, foods.length)} / {foods.length} 条</>
                : <>筛选出 <strong>{filteredFoods.length}</strong> 条结果，显示 {Math.min(displayCount, filteredFoods.length)} 条</>
              }
            </div>
            <div style={styles.grid}>
              {filteredFoods.slice(0, displayCount).map(food => (
                <div key={food.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <span style={styles.foodName}>{food.name}</span>
                    {food.rating ? (
                      <span style={styles.ratingTag}>⭐ {food.rating}</span>
                    ) : null}
                  </div>
                  <div style={styles.foodType}>{food.type}</div>
                  {food.address ? (
                    <div style={styles.foodAddr}>📍 {food.address}</div>
                  ) : null}
                  <div style={styles.cardFooter}>
                    <span style={styles.distance}>📏 {formatDistance(food.distance)}</span>
                    {food.cost ? <span style={styles.cost}>💰 {food.cost}</span> : null}
                    {food.tel ? <span style={styles.tel}>📞 {food.tel}</span> : null}
                  </div>
                </div>
              ))}
            </div>
            {displayCount < filteredFoods.length ? (
              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setDisplayCount(prev => Math.min(prev + 25, filteredFoods.length))}
                  style={styles.loadMoreBtn}
                >
                  加载更多（{Math.min(25, filteredFoods.length - displayCount)} 条）
                </button>
              </div>
            ) : null}
          </>
        ) : selectedPlace ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyIcon}>🍜</div>
            <div style={styles.emptyTitle}>附近暂无美食数据</div>
            <div style={styles.emptyDesc}>试试扩大搜索范围，或换个地点</div>
          </div>
        ) : (
          <div style={styles.emptyCard}>
            <div style={styles.emptyIcon}>🔍</div>
            <div style={styles.emptyTitle}>搜周边美食</div>
            <div style={styles.emptyDesc}>输入一个地名开始发现周围好吃的</div>
          </div>
        )}
      </div>
    </PageShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'grid', gap: '16px' },
  searchCard: {
    background: '#fff', borderRadius: '16px', padding: '20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  searchTitle: { fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '4px' },
  searchHint: { fontSize: '13px', color: '#6b7280', marginBottom: '12px' },
  searchRow: { display: 'flex', gap: '10px' },
  input: {
    flex: 1, padding: '10px 14px', borderRadius: '10px',
    border: '1px solid #d1d5db', fontSize: '14px', outline: 'none',
  },
  searchBtn: {
    padding: '10px 20px', borderRadius: '10px', border: 'none',
    background: '#4f46e5', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
    whiteSpace: 'nowrap',
  },
  errorText: {
    marginTop: '10px', padding: '8px 12px', borderRadius: '8px',
    background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '13px',
  },
  placeList: { marginTop: '12px', display: 'grid', gap: '8px' },
  placeItem: {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '12px 14px', borderRadius: '10px', border: '1px solid',
    cursor: 'pointer', background: '#fff',
  },
  placeName: { fontSize: '15px', fontWeight: 600, color: '#111827' },
  placeMeta: { fontSize: '13px', color: '#6b7280', marginTop: '4px' },
  selectedBadge: {
    display: 'inline-block', marginLeft: '8px', padding: '2px 8px',
    borderRadius: '999px', background: '#4f46e5', color: '#fff', fontSize: '11px', fontWeight: 600,
  },
  activeBar: {
    background: '#fff', borderRadius: '14px', padding: '14px 16px',
    border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  activePlace: { fontSize: '14px', color: '#111827' },
  activeCity: { marginLeft: '8px', color: '#6b7280', fontSize: '13px' },
  radiusRow: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  radiusLabel: { fontSize: '13px', color: '#6b7280' },
  radiusBtn: {
    padding: '5px 12px', borderRadius: '999px', border: '1px solid #d1d5db',
    background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
  },
  radiusBtnActive: {
    padding: '5px 12px', borderRadius: '999px', border: '1px solid #4f46e5',
    background: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
  },
  resultSummary: {
    fontSize: '13px', color: '#6b7280', textAlign: 'center',
  },
  emptyCard: {
    background: '#fff', borderRadius: '16px', padding: '60px', textAlign: 'center',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  emptyIcon: { fontSize: '48px', marginBottom: '12px' },
  emptyTitle: { fontSize: '18px', fontWeight: 600, color: '#374151', marginBottom: '8px' },
  emptyDesc: { fontSize: '14px', color: '#9ca3af' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
  },
  card: {
    background: '#fff', borderRadius: '12px', padding: '18px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px',
  },
  foodName: { fontSize: '16px', fontWeight: 600, color: '#1a1a2e' },
  ratingTag: {
    padding: '2px 8px', borderRadius: '999px', background: '#fff7ed',
    color: '#d97706', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
  },
  foodType: { fontSize: '12px', color: '#9ca3af' },
  foodAddr: { fontSize: '13px', color: '#6b7280', lineHeight: 1.5 },
  cardFooter: { display: 'flex', gap: '12px', fontSize: '13px', color: '#4b5563', marginTop: '4px' },
  distance: { color: '#059669' },
  cost: { color: '#d97706' },
  tel: { color: '#4f46e5' },
  filterRow: {
    display: 'flex', flexWrap: 'wrap', gap: '8px',
  },
  filterBtn: {
    padding: '6px 14px', borderRadius: '999px', border: '1px solid #d1d5db',
    background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
  },
  filterBtnActive: {
    padding: '6px 14px', borderRadius: '999px', border: '1px solid #4f46e5',
    background: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  },
  loadMoreBtn: {
    padding: '10px 40px', borderRadius: '12px', border: '1px solid #d1d5db',
    background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '14px',
    fontWeight: 600, marginTop: '12px',
  },
}
