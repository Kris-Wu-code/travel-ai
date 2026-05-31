'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Layers3, LocateFixed, Loader2, MapPinned, Route, Search, Volume2, VolumeX, Waypoints } from 'lucide-react'

type Poi = {
  id: string
  name: string
  type: string
  floor: number | null
  location: { lat: number; lng: number }
}

type Floor = {
  floor: number
  name: string | null
  width: number | null
  height: number | null
  scale: number | null
}

type RoutePoint = {
  id: string
  name: string
  type: string
  floor: number | null
  location: { lat: number; lng: number }
}

type GraphInfoResponse = {
  sceneId: string
  stats: {
    totalPois: number
    totalRoutes: number
    poiTypes: string[]
    floors: Array<number | null>
  }
  pois: Poi[]
  routes: Array<{
    fromId: string
    toId: string
    from: string | undefined
    to: string | undefined
    distance: number
    time: number
    floor: number | null
  }>
  floors: Floor[]
}

type RouteResult = {
  kind: 'shortest-path' | 'tsp'
  title: string
  distance: number
  estimatedTime: number
  path: string[]
  pathDetails: RoutePoint[]
  optimizationAlgorithm?: string
}

type NavigationPoi = Poi & {
  distanceToCurrent?: number
}

type InitialDestination = {
  name: string
  lng: number
  lat: number
}

declare global {
  interface Window {
    AMap?: any
    _AMapSecurityConfig?: { securityJsCode: string }
  }
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  if (s < 60) return `${s} 秒`
  if (s < 3600) return `${Math.floor(s / 60)} 分钟`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}

const AMAP_SCRIPT_ID = 'travel-ai-amap-js-sdk'
const ARRIVAL_THRESHOLD_METERS = 25

function distanceInMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadius = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function projectPointToSegment(
  point: { lat: number; lng: number },
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
) {
  const dx = end.lng - start.lng
  const dy = end.lat - start.lat

  if (dx === 0 && dy === 0) {
    return {
      lat: start.lat,
      lng: start.lng,
      distance: distanceInMeters(point, start),
    }
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.lng - start.lng) * dx + (point.lat - start.lat) * dy) / (dx * dx + dy * dy)),
  )
  const projected = {
    lng: start.lng + dx * t,
    lat: start.lat + dy * t,
  }

  return {
    ...projected,
    distance: distanceInMeters(point, projected),
  }
}

function findMatchedPositionOnPath(point: { lat: number; lng: number }, pathDetails: RoutePoint[]) {
  if (pathDetails.length < 2) {
    return null
  }

  let bestMatch: { lat: number; lng: number; distance: number; segmentIndex: number; segmentProgress: number } | null = null

  for (let index = 0; index < pathDetails.length - 1; index += 1) {
    const start = pathDetails[index].location
    const end = pathDetails[index + 1].location
    const dx = end.lng - start.lng
    const dy = end.lat - start.lat
    const segmentLength = Math.sqrt(dx * dx + dy * dy)
    const match = projectPointToSegment(point, start, end)

    if (!bestMatch || match.distance < bestMatch.distance) {
      bestMatch = {
        lat: match.lat,
        lng: match.lng,
        distance: match.distance,
        segmentIndex: index,
        segmentProgress: segmentLength === 0 ? 0 : Math.max(0, Math.min(1, ((match.lng - start.lng) * dx + (match.lat - start.lat) * dy) / (segmentLength * segmentLength))),
      }
    }
  }

  return bestMatch
}

function bearingInDegrees(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const lat1 = (from.lat * Math.PI) / 180
  const lat2 = (to.lat * Math.PI) / 180
  const dLng = ((to.lng - from.lng) * Math.PI) / 180

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  const degree = (Math.atan2(y, x) * 180) / Math.PI

  return (degree + 360) % 360
}

function bearingToText(bearing: number) {
  const directions = ['正北', '东北', '正东', '东南', '正南', '西南', '正西', '西北']
  const index = Math.round(bearing / 45) % 8
  return directions[index]
}

function turnHintAtNextPoint(pathDetails: RoutePoint[], currentStepIndex: number) {
  const current = pathDetails[currentStepIndex]
  const next = pathDetails[currentStepIndex + 1]
  const afterNext = pathDetails[currentStepIndex + 2]

  if (!current || !next || !afterNext) {
    return null
  }

  const v1x = next.location.lng - current.location.lng
  const v1y = next.location.lat - current.location.lat
  const v2x = afterNext.location.lng - next.location.lng
  const v2y = afterNext.location.lat - next.location.lat

  const cross = v1x * v2y - v1y * v2x
  const dot = v1x * v2x + v1y * v2y
  const angle = Math.atan2(Math.abs(cross), dot) * (180 / Math.PI)

  if (angle < 22) {
    return '直行'
  }

  if (angle > 150) {
    return '掉头'
  }

  return cross > 0 ? '左转' : '右转'
}

function loadAmapScript(key: string, securityJsCode: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('window is not available'))
      return
    }

    if (window.AMap) {
      resolve()
      return
    }

    if (securityJsCode) {
      window._AMapSecurityConfig = { securityJsCode }
    }

    const existingScript = document.getElementById(AMAP_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('高德地图脚本加载失败')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = AMAP_SCRIPT_ID
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.Scale,AMap.ToolBar`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('高德地图脚本加载失败'))
    document.head.appendChild(script)
  })
}

export function AmapNavigationShell({ sceneId, initialDestination }: { sceneId: string; initialDestination?: InitialDestination | null }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const currentPositionWatchRef = useRef<number | null>(null)
  const autoRerouteTimerRef = useRef<number | null>(null)
  const lastAutoRerouteStartRef = useRef<string>('')
  const lastSpokenRouteKeyRef = useRef<string>('')
  const lastSpokenStepRef = useRef<string>('')
  const [graphInfo, setGraphInfo] = useState<GraphInfoResponse | null>(null)
  const [graphError, setGraphError] = useState('')
  const [loadingGraph, setLoadingGraph] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [selectedFloor, setSelectedFloor] = useState<string>('all')
  const [selectionMode, setSelectionMode] = useState<'start' | 'end' | 'multi'>('start')
  const [startId, setStartId] = useState('')
  const [endId, setEndId] = useState('')
  const [selectedPoiIds, setSelectedPoiIds] = useState<string[]>([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [tracking, setTracking] = useState(false)
  const [trackingError, setTrackingError] = useState('')
  const [selectionNotice, setSelectionNotice] = useState('')
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [positionMode, setPositionMode] = useState<'none' | 'live' | 'mock'>('none')
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const appliedInitialDestinationKeyRef = useRef('')
  const autoPlanTriggerKeyRef = useRef('')
  const [navigationActive, setNavigationActive] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [navigationCompleted, setNavigationCompleted] = useState(false)

  const nearestPoiToCurrent = currentPosition && graphInfo?.pois.length
    ? graphInfo.pois.reduce<NavigationPoi | null>((closest, poi) => {
        const distanceToCurrent = Math.hypot(
          poi.location.lat - currentPosition.lat,
          poi.location.lng - currentPosition.lng,
        )

        if (!closest || distanceToCurrent < (closest.distanceToCurrent ?? Number.POSITIVE_INFINITY)) {
          return {
            ...poi,
            distanceToCurrent,
          }
        }

        return closest
      }, null)
    : null

  const effectiveStartPoi = startId
    ? graphInfo?.pois.find(poi => poi.id === startId) || null
    : (positionMode === 'live' || positionMode === 'mock') && nearestPoiToCurrent
      ? nearestPoiToCurrent
      : null

  const useCurrentPositionAsStart = !startId && (positionMode === 'live' || positionMode === 'mock') && !!effectiveStartPoi
  const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const currentStepPoint = routeResult?.pathDetails[currentStepIndex] ?? null
  const nextStepPoint = routeResult?.pathDetails[currentStepIndex + 1] ?? null
  const remainingStepCount = routeResult
    ? Math.max(routeResult.pathDetails.length - currentStepIndex - 1, 0)
    : 0
  const routePathKey = routeResult?.path.join('>') ?? ''
  const routePointCount = routeResult?.pathDetails.length ?? 0
  const currentLat = currentPosition?.lat ?? null
  const currentLng = currentPosition?.lng ?? null
  const matchedNavigationPosition = navigationActive && routeResult?.pathDetails.length && currentPosition
    ? findMatchedPositionOnPath(currentPosition, routeResult.pathDetails)
    : null
  const navigationAnchorPosition = matchedNavigationPosition
    ? { lat: matchedNavigationPosition.lat, lng: matchedNavigationPosition.lng }
    : currentPosition
  const currentRouteSegmentText = matchedNavigationPosition
    ? `第${matchedNavigationPosition.segmentIndex + 1}段`
    : navigationCompleted
      ? '已完成'
      : '未贴路'
  const distanceToNextStep = navigationAnchorPosition && nextStepPoint
    ? distanceInMeters(navigationAnchorPosition, nextStepPoint.location)
    : null
  const headingText = navigationAnchorPosition && nextStepPoint
    ? bearingToText(bearingInDegrees(navigationAnchorPosition, nextStepPoint.location))
    : null
  const nextTurnHint = routeResult ? turnHintAtNextPoint(routeResult.pathDetails, currentStepIndex) : null
  const stepInstruction = nextStepPoint
    ? `${Math.round(distanceToNextStep ?? 0)}米后到达${nextStepPoint.name}${nextTurnHint ? `，随后${nextTurnHint}` : ''}`
    : navigationCompleted
      ? '已到达终点'
      : '等待路线数据'

  const sceneJourneyBanner = useMemo(() => {
    if (routeLoading) {
      return {
        tone: 'info' as const,
        title: '正在自动规划',
        detail: '终点已带入，系统正在查询场内最短路径。',
      }
    }

    if (routeResult) {
      return {
        tone: 'success' as const,
        title: '路线已生成',
        detail: selectionNotice || '你可以直接查看步骤、切换路线或开启引导。',
      }
    }

    if (selectionNotice) {
      return {
        tone: 'info' as const,
        title: '终点已接入',
        detail: selectionNotice,
      }
    }

    if (endId) {
      return {
        tone: 'warning' as const,
        title: '等待起点',
        detail: '终点已选中，下一步可以选择起点或使用当前位置开始导航。',
      }
    }

    return {
      tone: 'neutral' as const,
      title: '等待目的地',
      detail: '请从地图带入终点，或在下方 POI 列表中手动选择。',
    }
  }, [endId, routeLoading, routeResult, selectionNotice])

  const sceneJourneyToneClass = sceneJourneyBanner.tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : sceneJourneyBanner.tone === 'info'
      ? 'border-cyan-200 bg-cyan-50 text-cyan-800'
      : sceneJourneyBanner.tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-slate-50 text-slate-700'

  const buildRouteSpeechText = (result: RouteResult) => {
    const steps = result.pathDetails
      .map((point, index) => `第${index + 1}步，前往${point.name}`)
      .join('。')

    return `${result.title}。总距离${result.distance}米，预计${formatDuration(result.estimatedTime)}。${steps}。`
  }

  const speakText = (text: string) => {
    if (!voiceSupported) {
      setVoiceError('当前浏览器不支持语音播报')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onend = () => setVoiceError('')
    utterance.onerror = () => setVoiceError('语音播报失败，请检查浏览器语音设置')
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeech = () => {
    if (!voiceSupported) {
      return
    }
    window.speechSynthesis.cancel()
  }

  const findNearestPoiFromPosition = (position: { lat: number; lng: number }) => {
    if (!graphInfo?.pois.length) {
      return null
    }

    return graphInfo.pois.reduce<NavigationPoi | null>((closest, poi) => {
      const distanceToCurrent = Math.hypot(
        poi.location.lat - position.lat,
        poi.location.lng - position.lng,
      )

      if (!closest || distanceToCurrent < (closest.distanceToCurrent ?? Number.POSITIVE_INFINITY)) {
        return {
          ...poi,
          distanceToCurrent,
        }
      }

      return closest
    }, null)
  }

  const requestCurrentPosition = async () => {
    if (!navigator.geolocation) {
      setTrackingError('当前浏览器不支持定位')
      setPositionMode('none')
      return null
    }

    return new Promise<{ lat: number; lng: number } | null>(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => {
          const nextPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          resolve(nextPosition)
        },
        error => {
          setTrackingError(error.message || '定位失败')
          setPositionMode('none')
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        },
      )
    })
  }

  const mockCurrentLocation = () => {
    if (!graphInfo?.pois.length) {
      return
    }

    const anchorPoi = effectiveStartPoi || graphInfo.pois[0]
    setTracking(false)
    setCurrentPosition(anchorPoi.location)
    setPositionMode('mock')
    setTrackingError('')

    const map = mapInstanceRef.current
    if (map) {
      map.setCenter([anchorPoi.location.lng, anchorPoi.location.lat])
      map.setZoom(18)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function fetchGraphInfo() {
      try {
        setLoadingGraph(true)
        const response = await fetch(`/api/navigation?action=graph-info&sceneId=${sceneId}`)
        const data = (await response.json()) as GraphInfoResponse & { error?: string }

        if (!response.ok) {
          throw new Error(data.error || '加载导航数据失败')
        }

        if (!cancelled) {
          setGraphInfo(data)
          setGraphError('')
        }
      } catch (error) {
        if (!cancelled) {
          setGraphError(error instanceof Error ? error.message : '加载导航数据失败')
        }
      } finally {
        if (!cancelled) {
          setLoadingGraph(false)
        }
      }
    }

    fetchGraphInfo()

    return () => {
      cancelled = true
    }
  }, [sceneId])

  useEffect(() => {
    if (!graphInfo?.pois.length || !initialDestination) {
      return
    }

    const destinationKey = `${initialDestination.name}:${initialDestination.lng.toFixed(6)},${initialDestination.lat.toFixed(6)}`
    if (appliedInitialDestinationKeyRef.current === destinationKey) {
      return
    }

    const exactNameMatch = graphInfo.pois.find(poi => poi.name === initialDestination.name)
    const nearestByDistance = graphInfo.pois.reduce<Poi | null>((closest, poi) => {
      const distance = Math.hypot(
        poi.location.lng - initialDestination.lng,
        poi.location.lat - initialDestination.lat,
      )

      if (!closest) {
        return poi
      }

      const closestDistance = Math.hypot(
        closest.location.lng - initialDestination.lng,
        closest.location.lat - initialDestination.lat,
      )

      return distance < closestDistance ? poi : closest
    }, null)

    const resolvedDestination = exactNameMatch ?? nearestByDistance
    if (!resolvedDestination) {
      return
    }

    appliedInitialDestinationKeyRef.current = destinationKey
    setSelectionMode('end')
    setEndId(resolvedDestination.id)
    setMapError('')
    setSelectionNotice(`已带入终点：${resolvedDestination.name}`)
  }, [graphInfo, initialDestination])

  useEffect(() => {
    if (!tracking) {
      if (currentPositionWatchRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(currentPositionWatchRef.current)
        currentPositionWatchRef.current = null
      }
      if (positionMode === 'live') {
        setPositionMode('none')
      }
      return
    }

    if (!navigator.geolocation) {
      setTrackingError('当前浏览器不支持定位')
      setPositionMode('none')
      return
    }

    setTrackingError('')
    currentPositionWatchRef.current = navigator.geolocation.watchPosition(
      position => {
        const nextPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }

        setCurrentPosition(nextPosition)
        setPositionMode('live')
        const map = mapInstanceRef.current
        if (map) {
          map.setCenter([nextPosition.lng, nextPosition.lat])
        }
      },
      error => {
        setTrackingError(error.message || '定位失败')
        setPositionMode('none')
        setTracking(false)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      },
    )

    return () => {
      if (currentPositionWatchRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(currentPositionWatchRef.current)
        currentPositionWatchRef.current = null
      }
    }
  }, [tracking, positionMode])

  useEffect(() => {
    return () => {
      if (voiceSupported) {
        window.speechSynthesis.cancel()
      }
    }
  }, [voiceSupported])

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      if (!graphInfo || !mapContainerRef.current) {
        return
      }

      const amapKey = process.env.NEXT_PUBLIC_AMAP_JS_KEY
      const securityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE || ''

      if (!amapKey) {
        setMapError('缺少高德地图前端 Key 配置')
        return
      }

      try {
        await loadAmapScript(amapKey, securityJsCode)
        if (cancelled || !mapContainerRef.current || !window.AMap) {
          return
        }

        const firstPoi = graphInfo.pois[0]
        const center = firstPoi ? [firstPoi.location.lng, firstPoi.location.lat] : [120.15, 30.27]

        if (!mapInstanceRef.current) {
          const map = new window.AMap.Map(mapContainerRef.current, {
            zoom: 18,
            center,
            viewMode: '2D',
            resizeEnable: true,
          })

          if (window.AMap.ToolBar) {
            map.addControl(new window.AMap.ToolBar())
          }
          if (window.AMap.Scale) {
            map.addControl(new window.AMap.Scale())
          }

          mapInstanceRef.current = map

          window.requestAnimationFrame(() => {
            if (!cancelled) {
              map.resize()
              map.setCenter(center)
            }
          })
        }

        setMapReady(true)
        setMapError('')
      } catch (error) {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : '地图初始化失败')
        }
      }
    }

    initMap()

    return () => {
      cancelled = true
    }
  }, [graphInfo])

  useEffect(() => {
    const map = mapInstanceRef.current
    const container = mapContainerRef.current

    if (!map || !container || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      map.resize()
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [mapReady])

  useEffect(() => {
    if (!mapReady || !graphInfo || !mapInstanceRef.current || !window.AMap) {
      return
    }

    const map = mapInstanceRef.current
    map.clearMap()
    const effectiveMarkerPosition = navigationActive && routeResult?.pathDetails.length && currentPosition
      ? findMatchedPositionOnPath(currentPosition, routeResult.pathDetails)
      : null

    const visiblePois = graphInfo.pois.filter(poi => {
      const floorMatch = selectedFloor === 'all' || String(poi.floor ?? 'all') === selectedFloor || poi.floor === null
      const searchMatch = !searchText || poi.name.toLowerCase().includes(searchText.toLowerCase())
      return floorMatch && searchMatch
    })

    const overlays: any[] = []

    for (const poi of visiblePois) {
      const isSelectedStart = poi.id === startId
      const isSelectedEnd = poi.id === endId
      const isInRoute = routeResult?.pathDetails.some(item => item.id === poi.id)
      const markerColor = isSelectedStart ? '#0b8f7a' : isSelectedEnd ? '#ff8a34' : isInRoute ? '#2563eb' : '#64748b'
      const label = `${poi.name}${poi.floor !== null ? ` · ${poi.floor}F` : ''}`
      const marker = new window.AMap.Marker({
        position: [poi.location.lng, poi.location.lat],
        title: label,
        content: `
          <div style="
            width: 18px;
            height: 18px;
            border-radius: 999px;
            border: 3px solid #fff;
            background: ${markerColor};
            box-shadow: 0 8px 16px rgba(15, 23, 42, 0.22);
          "></div>
        `,
        offset: new window.AMap.Pixel(-9, -9),
      })
      marker.setLabel({
        content: `<div style="padding:4px 8px;border-radius:999px;background:rgba(255,255,255,0.95);border:1px solid rgba(100,116,139,0.24);box-shadow:0 8px 16px rgba(15,23,42,0.08);font-size:12px;color:#334155;white-space:nowrap;">${label}</div>`,
        direction: 'top',
      })
      marker.on('click', () => {
        handleMapPoiSelect(poi.id)
      })
      overlays.push(marker)
    }

    if (routeResult?.pathDetails.length) {
      const path = routeResult.pathDetails.map(point => [point.location.lng, point.location.lat])
      const polyline = new window.AMap.Polyline({
        path,
        strokeColor: routeResult.kind === 'tsp' ? '#f97316' : '#0b8f7a',
        strokeWeight: 7,
        strokeOpacity: 0.92,
        lineJoin: 'round',
        lineCap: 'round',
      })
      overlays.push(polyline)
    }

    const markerPosition = effectiveMarkerPosition
      ? { lat: effectiveMarkerPosition.lat, lng: effectiveMarkerPosition.lng }
      : currentPosition

    if (markerPosition) {
      const currentMarker = new window.AMap.Marker({
        position: [markerPosition.lng, markerPosition.lat],
        title: effectiveMarkerPosition ? '当前位置（贴路）' : '当前位置',
        content: `
          <div style="
            width: 18px;
            height: 18px;
            border-radius: 999px;
            border: 4px solid rgba(11,143,122,0.22);
            background: #0b8f7a;
            box-shadow: 0 0 0 6px rgba(11,143,122,0.14);
          "></div>
        `,
        offset: new window.AMap.Pixel(-9, -9),
      })
      overlays.push(currentMarker)
    }

    map.add(overlays)

    if (overlays.length > 0) {
      map.setFitView(overlays, false, [40, 40, 40, 40])
    }
  }, [graphInfo, mapReady, routeResult, searchText, selectedFloor, startId, endId, currentPosition, navigationActive])

  const visiblePois = graphInfo?.pois.filter(poi => {
    const floorMatch = selectedFloor === 'all' || String(poi.floor ?? 'all') === selectedFloor || poi.floor === null
    const searchMatch = !searchText || poi.name.toLowerCase().includes(searchText.toLowerCase())
    return floorMatch && searchMatch
  }) ?? []

  const visibleFloors = graphInfo?.floors?.length
    ? graphInfo.floors
    : Array.from(new Set((graphInfo?.pois || []).map(poi => poi.floor).filter(floor => floor !== null)))
        .sort((left, right) => Number(left) - Number(right))
        .map(floor => ({ floor: floor as number, name: `${floor}F`, width: null, height: null, scale: null }))

  const runShortestPath = async (
    resolvedStartId: string,
    resolvedEndId: string,
    options?: { autoReroute?: boolean },
  ) => {
    setRouteLoading(true)
    try {
      const response = await fetch(
        `/api/navigation?action=shortest-path&sceneId=${sceneId}&startId=${resolvedStartId}&endId=${resolvedEndId}`,
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '最短路径查询失败')
      }

      const title = options?.autoReroute
        ? '检测到偏航，已自动重新规划路线'
        : useCurrentPositionAsStart
          ? '当前位置导航路线已找到'
          : '最优路线已找到'

      setRouteResult({
        kind: 'shortest-path',
        title,
        distance: data.distance,
        estimatedTime: data.estimatedTime,
        path: data.path || [],
        pathDetails: data.pathDetails || [],
      })
    } catch (error) {
      setMapError(error instanceof Error ? error.message : '最短路径查询失败')
    } finally {
      setRouteLoading(false)
    }
  }

  const handleShortestPath = async () => {
    let resolvedStartPoi = effectiveStartPoi

    if (!resolvedStartPoi && !startId) {
      const grantedPosition = await requestCurrentPosition()
      if (grantedPosition) {
        setCurrentPosition(grantedPosition)
        setPositionMode('live')
        setTracking(true)
        resolvedStartPoi = findNearestPoiFromPosition(grantedPosition)
      }
    }

    const resolvedStartId = resolvedStartPoi?.id ?? ''

    if (!resolvedStartId || !endId) {
      if (!startId) {
        setTrackingError('请允许定位权限，或手动选择起点后再导航')
      }
      return
    }

    if (resolvedStartId === endId) {
      setMapError('起点和终点不能相同，请重新选择')
      return
    }

    setTrackingError('')
    await runShortestPath(resolvedStartId, endId)
  }

  useEffect(() => {
    if (!initialDestination || !graphInfo?.pois.length || !endId || routeLoading || routeResult) {
      return
    }

    const triggerKey = `${initialDestination.name}:${endId}`
    if (autoPlanTriggerKeyRef.current === triggerKey) {
      return
    }

    autoPlanTriggerKeyRef.current = triggerKey
    setSelectionNotice(previous => previous ? `${previous}，正在自动规划` : '已带入终点，正在自动规划')
    void handleShortestPath()
  }, [endId, graphInfo, initialDestination, routeLoading, routeResult])

  useEffect(() => {
    if (!useCurrentPositionAsStart || !endId || !effectiveStartPoi || routeLoading) {
      return
    }

    if (!routeResult || routeResult.kind !== 'shortest-path') {
      return
    }

    const currentRouteStartId = routeResult.path[0]
    if (!currentRouteStartId || currentRouteStartId === effectiveStartPoi.id) {
      return
    }

    if (lastAutoRerouteStartRef.current === effectiveStartPoi.id) {
      return
    }

    if (autoRerouteTimerRef.current !== null) {
      window.clearTimeout(autoRerouteTimerRef.current)
      autoRerouteTimerRef.current = null
    }

    autoRerouteTimerRef.current = window.setTimeout(() => {
      lastAutoRerouteStartRef.current = effectiveStartPoi.id
      void runShortestPath(effectiveStartPoi.id, endId, { autoReroute: true })
    }, 800)

    return () => {
      if (autoRerouteTimerRef.current !== null) {
        window.clearTimeout(autoRerouteTimerRef.current)
        autoRerouteTimerRef.current = null
      }
    }
  }, [effectiveStartPoi, endId, routeLoading, routeResult, useCurrentPositionAsStart])

  useEffect(() => {
    if (!voiceEnabled || !routeResult || !routeResult.pathDetails.length) {
      return
    }

    const routeKey = `${routeResult.kind}:${routeResult.path.join('>')}`
    if (lastSpokenRouteKeyRef.current === routeKey) {
      return
    }

    lastSpokenRouteKeyRef.current = routeKey
    speakText(buildRouteSpeechText(routeResult))
  }, [routeResult, voiceEnabled])

  useEffect(() => {
    if (!routeResult || routeResult.pathDetails.length < 2) {
      setNavigationActive(false)
      setCurrentStepIndex(0)
      setNavigationCompleted(false)
      lastSpokenStepRef.current = ''
      return
    }

    setNavigationActive(true)
    setCurrentStepIndex(0)
    setNavigationCompleted(false)
    lastSpokenStepRef.current = ''
  }, [routeResult])

  useEffect(() => {
    const effectiveNavigationPoint = navigationActive && routeResult?.pathDetails.length && currentPosition
      ? findMatchedPositionOnPath(currentPosition, routeResult.pathDetails)
      : null

    if (!navigationActive || navigationCompleted || !routeResult || !effectiveNavigationPoint) {
      return
    }

    const targetIndex = currentStepIndex + 1
    if (targetIndex >= routeResult.pathDetails.length) {
      return
    }

    const targetPoint = routeResult.pathDetails[targetIndex]
    const distance = distanceInMeters(effectiveNavigationPoint, targetPoint.location)
    const enteredNextSegment = effectiveNavigationPoint.segmentIndex >= targetIndex

    if (!enteredNextSegment && distance > ARRIVAL_THRESHOLD_METERS) {
      return
    }

    if (targetIndex === routeResult.pathDetails.length - 1) {
      setCurrentStepIndex(targetIndex)
      setNavigationCompleted(true)
      setNavigationActive(false)

      if (voiceEnabled) {
        speakText(`已到达目的地${targetPoint.name}`)
      }
      return
    }

    setCurrentStepIndex(targetIndex)
  }, [currentLat, currentLng, currentStepIndex, navigationActive, navigationCompleted, routePointCount, voiceEnabled])

  useEffect(() => {
    if (!voiceEnabled || !navigationActive || !routeResult || !nextStepPoint) {
      return
    }

    const stepKey = `${routePathKey}:${currentStepIndex + 1}`
    if (lastSpokenStepRef.current === stepKey) {
      return
    }

    lastSpokenStepRef.current = stepKey
    const headingSpeech = headingText ? `朝${headingText}方向前进，` : ''
    const turnSpeech = nextTurnHint ? `到达后${nextTurnHint}。` : '请保持当前方向。'
    speakText(`下一步前往${nextStepPoint.name}。${headingSpeech}${Math.round(distanceToNextStep ?? 0)}米后到达，${turnSpeech}`)
  }, [currentStepIndex, distanceToNextStep, headingText, navigationActive, nextStepPoint, nextTurnHint, remainingStepCount, routePathKey, voiceEnabled])

  const handleTsp = async () => {
    if (selectedPoiIds.length < 3) {
      setMapError('请至少选择 3 个 POI')
      return
    }

    setRouteLoading(true)
    try {
      const response = await fetch(
        `/api/navigation?action=tsp&sceneId=${sceneId}&poiIds=${selectedPoiIds.join(',')}`,
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '多点规划失败')
      }

      setRouteResult({
        kind: 'tsp',
        title: '最优访问顺序已生成',
        distance: data.totalDistance,
        estimatedTime: data.estimatedTime,
        path: data.path || [],
        pathDetails: data.pathDetails || [],
        optimizationAlgorithm: data.optimizationAlgorithm,
      })
    } catch (error) {
      setMapError(error instanceof Error ? error.message : '多点规划失败')
    } finally {
      setRouteLoading(false)
    }
  }

  const togglePoi = (poiId: string) => {
    setSelectedPoiIds(previous =>
      previous.includes(poiId)
        ? previous.filter(id => id !== poiId)
        : [...previous, poiId],
    )
  }

  const handleMapPoiSelect = (poiId: string) => {
    if (selectionNotice) {
      setSelectionNotice('')
    }

    if (selectionMode === 'start') {
      setStartId(poiId)
    } else if (selectionMode === 'end') {
      setEndId(poiId)
    } else {
      togglePoi(poiId)
    }

    setMapError('')
  }

  const handleSwapStartEnd = () => {
    if (!startId || !endId) {
      return
    }

    setStartId(endId)
    setEndId(startId)
    setMapError('')
  }

  const handleClearRoute = () => {
    setStartId('')
    setEndId('')
    setSelectedPoiIds([])
    setRouteResult(null)
    setNavigationActive(false)
    setNavigationCompleted(false)
    setCurrentStepIndex(0)
    setTrackingError('')
    setMapError('')
    setSelectionNotice('')
    lastAutoRerouteStartRef.current = ''
    lastSpokenRouteKeyRef.current = ''
    lastSpokenStepRef.current = ''
    if (voiceSupported) {
      window.speechSynthesis.cancel()
    }
  }

  if (loadingGraph) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex items-center gap-3 text-slate-700">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
          正在加载导航数据...
        </div>
      </div>
    )
  }

  if (graphError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-lg">
        导航数据加载失败：{graphError}
      </div>
    )
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
      <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-teal-700 uppercase">
            <Route className="h-3.5 w-3.5" />
            高德地图导航
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">地图优先的导航页</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            先选起终点，再在地图上直接查看路线、POI 和楼层切换。
          </p>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            <span className="mb-2 block">搜索 POI</span>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={searchText}
                onChange={event => setSearchText(event.target.value)}
                placeholder="输入地点名称"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </label>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Layers3 className="h-4 w-4 text-teal-600" />
              楼层切换
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedFloor('all')}
                className={`rounded-full px-3 py-1.5 text-sm transition ${selectedFloor === 'all' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                全部
              </button>
              {visibleFloors.map(floor => (
                <button
                  key={String(floor.floor)}
                  type="button"
                  onClick={() => setSelectedFloor(String(floor.floor))}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${selectedFloor === String(floor.floor) ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {floor.name || `${floor.floor}F`}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MapPinned className="h-4 w-4 text-emerald-600" />
              地图点选模式
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectionMode('start')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${selectionMode === 'start' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                设为起点
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode('end')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${selectionMode === 'end' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                设为终点
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode('multi')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${selectionMode === 'multi' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                多点选择
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              在地图上直接点击 POI，即可快速设置起点、终点或加入多点规划。
            </p>
          </div>

          {selectionNotice ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
              {selectionNotice}
            </div>
          ) : null}

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-sm font-medium text-slate-700">
              起点
              <select
                value={startId}
                onChange={event => setStartId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              >
                <option value="">请选择起点</option>
                {graphInfo?.pois.map(poi => (
                  <option key={poi.id} value={poi.id}>
                    {poi.name}
                  </option>
                ))}
              </select>
            </label>

            {useCurrentPositionAsStart && currentPosition ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                当前定位将作为导航起点，吸附到最近 POI：
                <div className="mt-1 font-semibold text-emerald-900">
                  {effectiveStartPoi ? effectiveStartPoi.name : '正在计算最近点...'}
                </div>
              </div>
            ) : null}

            <label className="block text-sm font-medium text-slate-700">
              终点
              <select
                value={endId}
                onChange={event => setEndId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              >
                <option value="">请选择终点</option>
                {graphInfo?.pois.map(poi => (
                  <option key={poi.id} value={poi.id}>
                    {poi.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSwapStartEnd}
                disabled={!startId || !endId}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                交换起终点
              </button>
              <button
                type="button"
                onClick={handleClearRoute}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                清空路线
              </button>
            </div>

            <button
              type="button"
              onClick={handleShortestPath}
              disabled={routeLoading || !endId || (!!startId && !effectiveStartPoi)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {routeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPinned className="h-4 w-4" />}
              {!startId && !effectiveStartPoi && endId
                ? '授权定位并开始导航'
                : useCurrentPositionAsStart
                  ? '从当前位置开始导航'
                  : '查询起点终点路线'}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Waypoints className="h-4 w-4 text-orange-500" />
              多点规划
            </div>
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {visiblePois.map(poi => (
                <label key={poi.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedPoiIds.includes(poi.id)}
                    onChange={() => togglePoi(poi.id)}
                  />
                  <span className="flex-1 text-slate-700">{poi.name}</span>
                  <span className="text-xs text-slate-400">{poi.floor === null ? '室外' : `${poi.floor}F`}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleTsp}
              disabled={routeLoading || selectedPoiIds.length < 3}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {routeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Waypoints className="h-4 w-4" />}
              生成最优访问顺序
            </button>
          </div>

          <button
            type="button"
            onClick={() => setTracking(previous => !previous)}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${tracking ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            <LocateFixed className="h-4 w-4" />
            {tracking ? '关闭定位跟随' : '开启实时定位跟随'}
          </button>
          <button
            type="button"
            onClick={mockCurrentLocation}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            使用模拟当前位置
          </button>
          <div className="text-xs text-slate-500">
            当前模式：
            <span className="font-semibold text-slate-700">
              {positionMode === 'live' ? '实时定位' : positionMode === 'mock' ? '模拟定位' : '手动导航'}
            </span>
          </div>
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <button
              type="button"
              onClick={() => {
                setVoiceEnabled(previous => !previous)
                if (voiceEnabled) {
                  stopSpeech()
                }
                if (!voiceSupported) {
                  setVoiceError('当前浏览器不支持语音播报')
                }
              }}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${voiceEnabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {voiceEnabled ? '语音播报已开启' : '开启语音播报'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => speakText('导航语音测试。你可以开始规划路线。')}
                disabled={!voiceSupported}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                测试播报
              </button>
              <button
                type="button"
                onClick={stopSpeech}
                disabled={!voiceSupported}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                停止播报
              </button>
            </div>
            <p className="text-xs text-slate-500">路线生成或自动重算后会自动播报关键导航信息。</p>
          </div>
          {trackingError ? <p className="text-sm text-red-600">{trackingError}</p> : null}
          {voiceError ? <p className="text-sm text-red-600">{voiceError}</p> : null}
        </div>
      </aside>

      <main className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">地图</h3>
            <p className="text-sm text-slate-500">高德底图 + POI 标记 + 路线渲染</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>总 POI {graphInfo?.stats.totalPois ?? 0}</div>
            <div>当前结果 {routeResult ? routeResult.pathDetails.length : 0} 个点</div>
          </div>
        </div>

        <div className="relative h-[720px] overflow-hidden bg-slate-100">
          <div
            ref={mapContainerRef}
            className="absolute inset-0 amap-container"
            style={{ width: '100%', height: '100%', minHeight: '720px' }}
          />
          {!mapReady && !mapError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 text-slate-600">
              <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-lg">
                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                正在初始化地图...
              </div>
            </div>
          ) : null}
          {mapError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50/95 px-6 text-center text-red-700">
              <div>
                <p className="text-lg font-semibold">地图加载失败</p>
                <p className="mt-2 text-sm">{mapError}</p>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Route className="h-4 w-4 text-teal-600" />
          路线与步骤
        </div>

          <div className={`mb-4 rounded-2xl border px-4 py-3 ${sceneJourneyToneClass}`}>
            <div className="text-sm font-semibold">{sceneJourneyBanner.title}</div>
            <div className="mt-1 text-xs leading-5 opacity-90">{sceneJourneyBanner.detail}</div>
          </div>

        {routeResult ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700">逐步引导</div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${navigationCompleted ? 'bg-emerald-100 text-emerald-700' : navigationActive ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                  {navigationCompleted ? '已到达' : navigationActive ? '导航中' : '已暂停'}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-600">
                <div>当前位置步骤：{currentStepPoint ? `${currentStepIndex + 1}. ${currentStepPoint.name}` : '未开始'}</div>
                <div>下一目标点：{nextStepPoint ? nextStepPoint.name : navigationCompleted ? '已到达终点' : '暂无'}</div>
                <div>剩余步骤：{remainingStepCount}</div>
                  <div>路线段：{currentRouteSegmentText}</div>
                <div>
                  到下一点距离：
                  {distanceToNextStep !== null ? `${Math.round(distanceToNextStep)} m` : '等待定位中'}
                </div>
                <div>行进方位：{headingText || '等待定位中'}</div>
                <div>转向建议：{nextTurnHint || '保持当前方向'}</div>
                <div>当前指令：{stepInstruction}</div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!routeResult?.pathDetails.length) {
                      return
                    }

                    if (navigationCompleted) {
                      setNavigationCompleted(false)
                      setCurrentStepIndex(0)
                    }
                    setNavigationActive(previous => !previous)
                  }}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  {navigationCompleted ? '重新开始引导' : navigationActive ? '暂停引导' : '继续引导'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNavigationActive(false)
                    setNavigationCompleted(false)
                    setCurrentStepIndex(0)
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  重置步骤
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">{routeResult.title}</div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="text-slate-500">距离</div>
                  <div className="text-xl font-bold text-slate-900">{routeResult.distance} m</div>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="text-slate-500">预计时间</div>
                  <div className="text-xl font-bold text-slate-900">{formatDuration(routeResult.estimatedTime)}</div>
                </div>
              </div>
              {routeResult.optimizationAlgorithm ? (
                <div className="mt-3 text-xs text-slate-500">算法：{routeResult.optimizationAlgorithm}</div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-700">步骤详情</div>
              <div className="space-y-3">
                {routeResult.pathDetails.map((point, index) => (
                  <div
                    key={point.id}
                    className={`flex items-start gap-3 rounded-xl px-3 py-2 ${
                      index < currentStepIndex
                        ? 'bg-emerald-50'
                        : index === currentStepIndex
                          ? 'bg-teal-50'
                          : index === currentStepIndex + 1 && navigationActive
                            ? 'bg-orange-50'
                            : 'bg-slate-50'
                    }`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                      index < currentStepIndex
                        ? 'bg-emerald-600'
                        : index === currentStepIndex
                          ? 'bg-teal-600'
                          : index === currentStepIndex + 1 && navigationActive
                            ? 'bg-orange-500'
                            : 'bg-slate-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">{point.name}</div>
                      <div className="text-xs text-slate-500">
                        {point.type} · {point.floor === null ? '室外' : `${point.floor}F`}
                      </div>
                      {index === currentStepIndex ? (
                        <div className="mt-1 text-xs font-semibold text-teal-700">当前所处步骤</div>
                      ) : null}
                      {index === currentStepIndex + 1 && navigationActive ? (
                        <div className="mt-1 text-xs font-semibold text-orange-700">下一目标点</div>
                      ) : null}
                      {index < currentStepIndex ? (
                        <div className="mt-1 text-xs font-semibold text-emerald-700">已通过</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
            先选择起点和终点，或勾选 3 个以上 POI 生成多点规划。路线结果会直接绘制在地图上。
          </div>
        )}

        {currentPosition ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            当前定位：{currentPosition.lat.toFixed(5)}, {currentPosition.lng.toFixed(5)}
          </div>
        ) : null}
      </aside>
    </div>
  )
}
