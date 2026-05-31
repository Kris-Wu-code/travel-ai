'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LEGEND_ITEMS, classifyLegendKey, createLegendVisibility, getIconMeta } from '@/app/lib/map-icons'

type MapPoint = {
  id: string
  name: string
  lng: number
  lat: number
}

type BuildingPoint = MapPoint & {
  kind: string
}

type FacilityPoint = MapPoint & {
  category: string
}

type RoadLine = {
  id: string
  highwayType: string
  points: number[][]
}

type MapPayload = {
  dataset: 'bupt_shahe' | 'forbidden_city' | 'badaling'
  stats: {
    buildings: number
    facilities: number
    roads: number
    facilityKinds: number
  }
  bbox: {
    minLng: number
    maxLng: number
    minLat: number
    maxLat: number
  } | null
  buildings: BuildingPoint[]
  facilities: FacilityPoint[]
  roads: RoadLine[]
}

type SelectedPoi = {
  id: string
  type: 'building' | 'facility'
  name: string
  categoryText: string
  lng: number
  lat: number
}

type RenderSingle = {
  kind: 'single'
  id: string
  domain: 'building' | 'facility'
  x: number
  y: number
  categoryText: string
  name: string
  lng: number
  lat: number
}

type RenderCluster = {
  kind: 'cluster'
  id: string
  domain: 'building' | 'facility'
  x: number
  y: number
  count: number
  sampleCategory: string
}

const VIEW_W = 980
const VIEW_H = 560
const PADDING = 24

function projectPoint(lng: number, lat: number, bbox: MapPayload['bbox']) {
  if (!bbox) return { x: VIEW_W / 2, y: VIEW_H / 2 }

  const lngRange = Math.max(0.00001, bbox.maxLng - bbox.minLng)
  const latRange = Math.max(0.00001, bbox.maxLat - bbox.minLat)

  const x = PADDING + ((lng - bbox.minLng) / lngRange) * (VIEW_W - PADDING * 2)
  const y = VIEW_H - PADDING - ((lat - bbox.minLat) / latRange) * (VIEW_H - PADDING * 2)

  return { x, y }
}

function textIncludes(value: string, keyword: string) {
  return value.toLowerCase().includes(keyword.toLowerCase())
}

export default function CampusMapPanel() {
  const router = useRouter()
  const [dataset, setDataset] = useState<'bupt_shahe' | 'forbidden_city' | 'badaling'>('bupt_shahe')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [showRoads, setShowRoads] = useState(true)
  const [showBuildings, setShowBuildings] = useState(true)
  const [showFacilities, setShowFacilities] = useState(true)
  const [data, setData] = useState<MapPayload | null>(null)
  const [selected, setSelected] = useState<SelectedPoi | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Pan & zoom state
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const draggingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const [legendVisible, setLegendVisible] = useState<Record<string, boolean>>(() => createLegendVisibility())

  useEffect(() => {
    let alive = true

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/campus-map?dataset=${dataset}`, { cache: 'no-store' })
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload?.error || '加载地图数据失败')
        }

        if (!alive) return
        setData(payload as MapPayload)
        setSelected(null)
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : '加载地图数据失败')
      } finally {
        if (alive) setLoading(false)
      }
    }

    loadData()

    return () => {
      alive = false
    }
  }, [dataset])

  const filteredBuildings = useMemo(() => {
    if (!data) return []
    const trimmed = keyword.trim()
    if (!trimmed) return data.buildings

    return data.buildings.filter(item => {
      return textIncludes(item.name, trimmed) || textIncludes(item.kind, trimmed)
    })
  }, [data, keyword])

  const filteredFacilities = useMemo(() => {
    if (!data) return []
    const trimmed = keyword.trim()
    if (!trimmed) return data.facilities

    return data.facilities.filter(item => {
      return textIncludes(item.name, trimmed) || textIncludes(item.category, trimmed)
    })
  }, [data, keyword])

  const visibleBuildings = useMemo(() => {
    return filteredBuildings.filter(item => {
      const key = classifyLegendKey(item.kind, 'building')
      return key === '其他' || !!legendVisible[key]
    })
  }, [filteredBuildings, legendVisible])

  const visibleFacilities = useMemo(() => {
    return filteredFacilities.filter(item => {
      const key = classifyLegendKey(item.category, 'facility')
      return key === '其他' || !!legendVisible[key]
    })
  }, [filteredFacilities, legendVisible])

  const roadPolylines = useMemo(() => {
    if (!data || !data.bbox) return []

    return data.roads
      .map(road => {
        const points = road.points
          .map(([lng, lat]) => {
            const p = projectPoint(lng, lat, data.bbox)
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
          })
          .join(' ')

        return {
          id: road.id,
          points,
        }
      })
      .filter(item => item.points.length > 0)
  }, [data])

  const clusterMode = scale < 1.35 && keyword.trim().length === 0

  const renderPois = useMemo(() => {
    if (!data || !data.bbox) return [] as Array<RenderSingle | RenderCluster>

    if (!clusterMode) {
      const singlesFromBuildings: RenderSingle[] = visibleBuildings.map(item => {
        const p = projectPoint(item.lng, item.lat, data.bbox)
        return {
          kind: 'single',
          id: `building-${item.id}`,
          domain: 'building',
          x: p.x,
          y: p.y,
          categoryText: item.kind,
          name: item.name,
          lng: item.lng,
          lat: item.lat,
        }
      })

      const singlesFromFacilities: RenderSingle[] = visibleFacilities.map(item => {
        const p = projectPoint(item.lng, item.lat, data.bbox)
        return {
          kind: 'single',
          id: `facility-${item.id}`,
          domain: 'facility',
          x: p.x,
          y: p.y,
          categoryText: item.category,
          name: item.name,
          lng: item.lng,
          lat: item.lat,
        }
      })

      return [...singlesFromBuildings, ...singlesFromFacilities]
    }

    const cellSizePx = 52
    const worldCell = cellSizePx / Math.max(scale, 0.01)

    type Acc = {
      count: number
      sumX: number
      sumY: number
      sampleCategory: string
      sample: RenderSingle
    }

    const buckets = new Map<string, Acc>()

    function pushSingle(single: RenderSingle) {
      const gx = Math.floor(single.x / worldCell)
      const gy = Math.floor(single.y / worldCell)
      const key = `${single.domain}:${gx}:${gy}`
      const prev = buckets.get(key)

      if (!prev) {
        buckets.set(key, {
          count: 1,
          sumX: single.x,
          sumY: single.y,
          sampleCategory: single.categoryText,
          sample: single,
        })
        return
      }

      prev.count += 1
      prev.sumX += single.x
      prev.sumY += single.y
    }

    visibleBuildings.forEach(item => {
      const p = projectPoint(item.lng, item.lat, data.bbox)
      pushSingle({
        kind: 'single',
        id: `building-${item.id}`,
        domain: 'building',
        x: p.x,
        y: p.y,
        categoryText: item.kind,
        name: item.name,
        lng: item.lng,
        lat: item.lat,
      })
    })

    visibleFacilities.forEach(item => {
      const p = projectPoint(item.lng, item.lat, data.bbox)
      pushSingle({
        kind: 'single',
        id: `facility-${item.id}`,
        domain: 'facility',
        x: p.x,
        y: p.y,
        categoryText: item.category,
        name: item.name,
        lng: item.lng,
        lat: item.lat,
      })
    })

    const result: Array<RenderSingle | RenderCluster> = []
    for (const [key, acc] of buckets.entries()) {
      if (acc.count <= 1) {
        result.push(acc.sample)
        continue
      }

      result.push({
        kind: 'cluster',
        id: `cluster-${key}`,
        domain: acc.sample.domain,
        x: acc.sumX / acc.count,
        y: acc.sumY / acc.count,
        count: acc.count,
        sampleCategory: acc.sampleCategory,
      })
    }

    return result
  }, [clusterMode, data, scale, keyword, visibleBuildings, visibleFacilities])

  function renderIcon(x: number, y: number, meta: { color: string; label: string }, size = 8) {
    const fontSize = Math.max(6, Math.floor(size * 0.9))
    return (
      <g transform={`translate(${x - size},${y - size})`}>
        <rect x={0} y={0} width={size * 2} height={size * 2} rx={size * 0.5} fill={meta.color} opacity={0.95} />
        <text x={size} y={size + fontSize / 3} fontSize={fontSize} textAnchor="middle" fill="#fff" style={{ fontWeight: 700 }}>
          {meta.label}
        </text>
      </g>
    )
  }

  // Legend renderer (small inline SVG icons)
  function renderLegendIcon(meta: { color: string; label: string }, size = 8) {
    const fontSize = Math.max(6, Math.floor(size * 0.9))
    const w = size * 2
    const h = size * 2
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        <rect x={0} y={0} width={w} height={h} rx={size * 0.5} fill={meta.color} opacity={0.95} />
        <text x={w / 2} y={h / 2 + fontSize / 3} fontSize={fontSize} textAnchor="middle" fill="#fff" style={{ fontWeight: 700 }}>
          {meta.label}
        </text>
      </svg>
    )
  }

  function toggleLegend(key: string) {
    setLegendVisible(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Interaction handlers
  function clamp(v: number, a: number, b: number) {
    return Math.max(a, Math.min(b, v))
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const delta = e.deltaY < 0 ? 1.12 : 0.88
    const newScale = clamp(scale * delta, 0.5, 6)

    // adjust offset so the point under cursor stays stable
    const ox = mx - (mx - offset.x) * (newScale / scale)
    const oy = my - (my - offset.y) * (newScale / scale)

    setScale(newScale)
    setOffset({ x: ox, y: oy })
  }

  function handlePointerDown(e: React.PointerEvent) {
    const el = svgRef.current
    if (!el) return
    (e.target as Element).setPointerCapture(e.pointerId)
    draggingRef.current = true
    lastPosRef.current = { x: e.clientX, y: e.clientY }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current || !lastPosRef.current) return
    const dx = e.clientX - lastPosRef.current.x
    const dy = e.clientY - lastPosRef.current.y
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }))
  }

  function handlePointerUp(e: React.PointerEvent) {
    draggingRef.current = false
    lastPosRef.current = null
  }

  function zoomIn() {
    const newScale = clamp(scale * 1.25, 0.5, 6)
    setScale(newScale)
  }

  function zoomOut() {
    const newScale = clamp(scale / 1.25, 0.5, 6)
    setScale(newScale)
  }

  function resetView() {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  function zoomToPoint(x: number, y: number) {
    const nextScale = clamp(scale * 1.45, 0.5, 6)
    const ox = VIEW_W / 2 - x * nextScale
    const oy = VIEW_H / 2 - y * nextScale
    setScale(nextScale)
    setOffset({ x: ox, y: oy })
  }

  function startNavigationForSelected() {
    if (!selected) return
    const params = new URLSearchParams()
    params.set('mode', 'real-world')
    params.set('destName', selected.name)
    params.set('destLng', String(selected.lng))
    params.set('destLat', String(selected.lat))
    router.push(`/navigation?${params.toString()}`)
  }

  function fitToData() {
    if (!data || !data.bbox) return
    const b = data.bbox
    const lngRange = Math.max(0.00001, b.maxLng - b.minLng)
    const latRange = Math.max(0.00001, b.maxLat - b.minLat)

    const scaleX = (VIEW_W - PADDING * 2) / (lngRange === 0 ? 1 : lngRange)
    const scaleY = (VIEW_H - PADDING * 2) / (latRange === 0 ? 1 : latRange)
    const targetScale = Math.max(0.5, Math.min(6, Math.min(scaleX, scaleY)))

    const centerLng = (b.minLng + b.maxLng) / 2
    const centerLat = (b.minLat + b.maxLat) / 2
    const centerBase = projectPoint(centerLng, centerLat, b)
    if (!centerBase) return

    const ox = VIEW_W / 2 - centerBase.x * targetScale
    const oy = VIEW_H / 2 - centerBase.y * targetScale

    setScale(targetScale)
    setOffset({ x: ox, y: oy })
  }

  const resultList = useMemo(() => {
    const buildings = filteredBuildings.map(item => ({
      id: item.id,
      type: 'building' as const,
      name: item.name,
      categoryText: item.kind,
      lng: item.lng,
      lat: item.lat,
    }))

    const facilities = filteredFacilities.map(item => ({
      id: item.id,
      type: 'facility' as const,
      name: item.name,
      categoryText: item.category,
      lng: item.lng,
      lat: item.lat,
    }))

    return [...buildings, ...facilities].slice(0, 60)
  }, [filteredBuildings, filteredFacilities])

  return (
    <section style={styles.wrap}>
      <div style={styles.topBar}>
        <div style={styles.titleWrap}>
          <div style={styles.title}>地图展示与搜索</div>
          <div style={styles.subtitle}>包含标注、图层、详情联动。当前默认加载北邮沙河，可切换故宫或八达岭长城。</div>
        </div>

        <select
          style={styles.datasetSelect}
          value={dataset}
          onChange={event => setDataset(event.target.value as 'bupt_shahe' | 'forbidden_city' | 'badaling')}
        >
          <option value="bupt_shahe">北京邮电大学沙河校区</option>
          <option value="forbidden_city">故宫</option>
          <option value="badaling">八达岭长城</option>
        </select>
      </div>

      <div style={styles.controlRow}>
        <input
          style={styles.searchInput}
          placeholder="搜索建筑名 / 设施名 / 类型"
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
        />

        <label style={styles.switchLabel}>
          <input type="checkbox" checked={showRoads} onChange={event => setShowRoads(event.target.checked)} /> 道路
        </label>
        <label style={styles.switchLabel}>
          <input type="checkbox" checked={showBuildings} onChange={event => setShowBuildings(event.target.checked)} /> 建筑
        </label>
        <label style={styles.switchLabel}>
          <input type="checkbox" checked={showFacilities} onChange={event => setShowFacilities(event.target.checked)} /> 设施
        </label>
      </div>

      {loading ? <div style={styles.empty}>地图数据加载中...</div> : null}
      {error ? <div style={styles.error}>{error}</div> : null}

      {!loading && !error && data ? (
        <>
          <div style={styles.statsRow}>
            <span>建筑: {data.stats.buildings}</span>
            <span>设施: {data.stats.facilities}</span>
            <span>设施类型: {data.stats.facilityKinds}</span>
            <span>道路段: {data.stats.roads}</span>
            <span>搜索结果: {resultList.length}</span>
          </div>

          <div style={styles.mainGrid}>
            <div style={styles.mapCard}>
              <div style={styles.mapControls}>
                <div style={styles.mapControlButtons}>
                  <button type="button" onClick={zoomIn} style={styles.ctrlBtn}>＋</button>
                  <button type="button" onClick={zoomOut} style={styles.ctrlBtn}>－</button>
                  <button type="button" onClick={resetView} style={styles.ctrlBtn}>重置</button>
                  <button type="button" onClick={fitToData} style={styles.ctrlBtn}>适配全图</button>
                </div>
                <div style={styles.mapInfo}>缩放: {scale.toFixed(2)}</div>
              </div>

              <svg
                ref={svgRef}
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                style={styles.svg}
                role="img"
                aria-label="校园与景区地图图层"
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#f9fcfa" />

                <g transform={`translate(${offset.x},${offset.y}) scale(${scale})`}>
                  {showRoads && roadPolylines.map(road => (
                    <polyline
                      key={road.id}
                      points={road.points}
                      fill="none"
                      stroke="#98a8a4"
                      strokeWidth={1.25}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.7}
                    />
                  ))}

                  {renderPois.map(item => {
                    if (item.domain === 'building' && !showBuildings) return null
                    if (item.domain === 'facility' && !showFacilities) return null

                    if (item.kind === 'cluster') {
                      const meta = getIconMeta(item.sampleCategory, item.domain)
                      return (
                        <g
                          key={item.id}
                          onClick={() => {
                            setSelected(null)
                            zoomToPoint(item.x, item.y)
                          }}
                          style={{ cursor: 'zoom-in' }}
                        >
                          <circle cx={item.x} cy={item.y} r={10} fill={meta.color} opacity={0.9} />
                          <text x={item.x} y={item.y + 4} textAnchor="middle" fill="#fff" fontSize={11} style={{ fontWeight: 800 }}>
                            {item.count}
                          </text>
                        </g>
                      )
                    }

                    const active = selected?.type === item.domain && selected.id === item.id.replace(`${item.domain}-`, '')
                    const meta = getIconMeta(item.categoryText, item.domain)
                    return (
                      <g
                        key={item.id}
                        onClick={() => setSelected({
                          id: item.id.replace(`${item.domain}-`, ''),
                          type: item.domain,
                          name: item.name,
                          categoryText: item.categoryText,
                          lng: item.lng,
                          lat: item.lat,
                        })}
                        style={{ cursor: 'pointer' }}
                      >
                        {renderIcon(item.x, item.y, meta, active ? 8.5 : (item.domain === 'building' ? 7 : 6))}
                      </g>
                    )
                  })}
                </g>
              </svg>
            </div>

            <div style={styles.sideCard}>
              <div style={styles.sideTitle}>详情面板</div>

              <div style={styles.legendWrap}>
                <div style={styles.legendTitle}>图例</div>
                <div style={styles.legendGrid}>
                  {LEGEND_ITEMS.map(it => {
                    const meta = getIconMeta(it.key, it.domain)
                    const visible = !!legendVisible[it.key]
                    return (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => toggleLegend(it.key)}
                        style={{
                          ...styles.legendItem,
                          background: visible ? '#fff' : '#fbfafa',
                          border: visible ? '1px solid #e6f0ec' : '1px dashed #f0e9e9',
                          cursor: 'pointer',
                          opacity: visible ? 1 : 0.45,
                        }}
                      >
                        <div style={styles.legendIcon}>{renderLegendIcon(meta, 8)}</div>
                        <div style={styles.legendLabel}>{it.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selected ? (
                <div style={styles.detailCard}>
                  <div style={styles.detailName}>{selected.name}</div>
                  <div style={styles.detailMeta}>类型: {selected.type === 'building' ? '建筑' : '设施'}</div>
                  <div style={styles.detailMeta}>分类: {selected.categoryText}</div>
                  <div style={styles.detailMeta}>坐标: {selected.lng.toFixed(6)}, {selected.lat.toFixed(6)}</div>
                  <button type="button" style={styles.navBtn} onClick={startNavigationForSelected}>
                    开始导航
                  </button>
                </div>
              ) : (
                <div style={styles.emptyHint}>点击地图上的标注点查看详情。</div>
              )}

              <div style={styles.sideTitle}>搜索结果</div>
              <div style={styles.resultList}>
                {resultList.map(item => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    style={styles.resultRow}
                    onClick={() => setSelected(item)}
                  >
                    <span style={styles.resultName}>{item.name}</span>
                    <span style={styles.resultMeta}>{item.type === 'building' ? '建筑' : '设施'} · {item.categoryText}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #dbe7e3',
    padding: '18px',
    boxShadow: '0 8px 22px rgba(21, 32, 38, 0.06)',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  titleWrap: {
    display: 'grid',
    gap: '6px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#172026',
  },
  subtitle: {
    fontSize: '13px',
    color: '#5f7270',
    lineHeight: 1.7,
  },
  datasetSelect: {
    minWidth: '220px',
    borderRadius: '10px',
    border: '1px solid #d0ddd8',
    height: '38px',
    padding: '0 10px',
    background: '#ffffff',
    color: '#1a2a2a',
  },
  controlRow: {
    marginTop: '14px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    alignItems: 'center',
  },
  searchInput: {
    flex: '1 1 280px',
    minWidth: '220px',
    height: '38px',
    borderRadius: '10px',
    border: '1px solid #d0ddd8',
    padding: '0 12px',
    outline: 'none',
    fontSize: '14px',
  },
  switchLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#435b58',
  },
  empty: {
    marginTop: '14px',
    color: '#718180',
    fontSize: '14px',
  },
  error: {
    marginTop: '14px',
    borderRadius: '10px',
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    color: '#9f1239',
    fontSize: '13px',
    padding: '10px 12px',
  },
  statsRow: {
    marginTop: '14px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    fontSize: '12px',
    color: '#607472',
  },
  mainGrid: {
    marginTop: '12px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    gap: '14px',
  },
  mapCard: {
    borderRadius: '12px',
    border: '1px solid #dce8e4',
    overflow: 'hidden',
    background: '#ffffff',
  },
  svg: {
    width: '100%',
    height: '560px',
    display: 'block',
  },
  mapControls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    gap: '8px',
  },
  mapControlButtons: {
    display: 'flex',
    gap: '6px',
  },
  ctrlBtn: {
    borderRadius: '8px',
    border: '1px solid #d0ddd8',
    background: '#ffffff',
    padding: '6px 8px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  mapInfo: {
    fontSize: '13px',
    color: '#4b6b67',
  },
  sideCard: {
    borderRadius: '12px',
    border: '1px solid #dce8e4',
    padding: '12px',
    background: '#fcfefd',
    maxHeight: '560px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sideTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#213133',
  },
  detailCard: {
    borderRadius: '10px',
    border: '1px solid #d6e5e1',
    background: '#ffffff',
    padding: '10px',
    display: 'grid',
    gap: '6px',
  },
  detailName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#122125',
  },
  detailMeta: {
    fontSize: '12px',
    color: '#526566',
  },
  navBtn: {
    marginTop: '6px',
    borderRadius: '8px',
    border: '1px solid #0f766e',
    background: '#0f766e',
    color: '#ffffff',
    height: '34px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  emptyHint: {
    borderRadius: '10px',
    border: '1px dashed #d6e5e1',
    color: '#6d8080',
    padding: '10px',
    fontSize: '12px',
    lineHeight: 1.6,
  },
  resultList: {
    marginTop: '4px',
    display: 'grid',
    gap: '8px',
    overflow: 'auto',
    paddingRight: '3px',
  },
  legendWrap: {
    marginTop: '8px',
    marginBottom: '8px',
    padding: '6px',
    borderRadius: '8px',
    border: '1px solid #e6f0ec',
    background: '#ffffff',
  },
  legendTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#213133',
    marginBottom: '6px',
  },
  legendGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px',
  },
  legendIcon: {
    width: '20px',
    height: '20px',
    display: 'inline-block',
  },
  legendLabel: {
    fontSize: '12px',
    color: '#435b58',
  },
  resultRow: {
    textAlign: 'left',
    borderRadius: '10px',
    border: '1px solid #deebe7',
    background: '#ffffff',
    padding: '8px 9px',
    display: 'grid',
    gap: '4px',
    cursor: 'pointer',
  },
  resultName: {
    fontSize: '13px',
    color: '#12242b',
    fontWeight: 700,
  },
  resultMeta: {
    fontSize: '12px',
    color: '#5d7170',
  },
}
