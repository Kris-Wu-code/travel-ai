'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Car, Check, Clock3, Footprints, Loader2, MapPin, Route, Search, Sparkles } from 'lucide-react'

type Poi = {
  id: string
  name: string
  type: string
  typeCode: string
  city: string
  district: string
  address: string
  latitude: number | null
  longitude: number | null
  provider: 'amap'
}

type SearchResponse = {
  pois: Poi[]
  total: number
  page: number
  offset: number
  query?: {
    keyword: string
    city: string
    types: string
  }
  error?: string
  message?: string
}

type RouteMode = 'walking' | 'driving'
type FollowMode = 'locked' | 'free'

type RouteStep = {
  instruction: string
  road: string
  distance: number
  duration: number
  polyline: Array<{ lng: number; lat: number }>
}

type RoutePlan = {
  mode: RouteMode
  origin: { lng: number; lat: number }
  destination: { lng: number; lat: number }
  id: string
  label: string
  reason: string
  strategy: number
  summary: {
    distance: number
    duration: number
    trafficLights?: number
    taxiCost?: number
  }
  steps: RouteStep[]
  polyline: Array<{ lng: number; lat: number }>
  provider: 'amap'
  error?: string
  message?: string
}

type RouteCollectionResponse = RoutePlan & {
  routes: RoutePlan[]
  activeRouteId: string
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

const AMAP_SCRIPT_ID = 'travel-ai-real-world-amap-js-sdk'
const WALKING_DEVIATION_THRESHOLD_METERS = 60
const DRIVING_DEVIATION_THRESHOLD_METERS = 120
const AUTO_REROUTE_COOLDOWN_MS = 15000

type ErrorScene = 'search' | 'route' | 'tracking' | 'map' | 'location' | 'voice'

type RouteRequestPayload = {
  mode: RouteMode
  origin: { lng: number; lat: number }
  destination: { lng: number; lat: number }
}

function toFriendlyErrorMessage(rawMessage: string, scene: ErrorScene) {
  const message = (rawMessage || '').toLowerCase()

  if (message.includes('permission') || message.includes('denied') || message.includes('forbidden')) {
    return scene === 'location' || scene === 'tracking'
      ? '定位权限被拒绝，请在浏览器设置中允许定位后重试。'
      : '权限不足，请检查访问权限后重试。'
  }

  if (message.includes('network') || message.includes('failed to fetch') || message.includes('timeout') || message.includes('timed out')) {
    return '网络异常或请求超时，请检查网络后重试。'
  }

  if (message.includes('key') || message.includes('invalid_user_key') || message.includes('signature')) {
    return '地图服务鉴权失败，请检查 Key 与安全码配置。'
  }

  if (message.includes('quota') || message.includes('too many requests') || message.includes('rate limit')) {
    return '请求过于频繁，请稍后再试。'
  }

  if (message.includes('no walking route') || message.includes('too far for walking') || message.includes('不推荐步行')) {
    return '起终点距离过远，不推荐步行。请切换到驾车模式再规划路线。'
  }

  if (scene === 'search') return '真实 POI 搜索失败，请稍后重试。'
  if (scene === 'route') return '路线规划失败，请检查起终点或稍后重试。'
  if (scene === 'map') return '地图初始化失败，请刷新或重试。'
  if (scene === 'tracking') return '实时跟随启动失败，请检查定位权限后重试。'
  if (scene === 'voice') return '语音播报失败，请检查浏览器语音设置。'

  return '操作失败，请稍后重试。'
}

function distanceInMeters(a: { lng: number; lat: number }, b: { lng: number; lat: number }) {
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
  point: { lng: number; lat: number },
  start: { lng: number; lat: number },
  end: { lng: number; lat: number },
) {
  const dx = end.lng - start.lng
  const dy = end.lat - start.lat

  if (dx === 0 && dy === 0) {
    return {
      lng: start.lng,
      lat: start.lat,
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

function distanceToRoute(point: { lng: number; lat: number }, polyline: Array<{ lng: number; lat: number }>) {
  if (polyline.length < 2) {
    return Number.POSITIVE_INFINITY
  }

  let minDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < polyline.length - 1; index += 1) {
    const projected = projectPointToSegment(point, polyline[index], polyline[index + 1])
    if (projected.distance < minDistance) {
      minDistance = projected.distance
    }
  }

  return minDistance
}

type RouteProgress = {
  distanceToRoute: number
  nearestPoint: { lng: number; lat: number }
  segmentIndex: number
  segmentProgress: number
  distanceAlongRoute: number
}

function getRouteProgress(point: { lng: number; lat: number }, polyline: Array<{ lng: number; lat: number }>) {
  if (polyline.length < 2) {
    return null
  }

  let bestMatch: RouteProgress | null = null
  let distanceBeforeSegment = 0

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const start = polyline[index]
    const end = polyline[index + 1]
    const projected = projectPointToSegment(point, start, end)
    const segmentLength = distanceInMeters(start, end)
    const segmentProgress = segmentLength <= 0 ? 0 : Math.max(0, Math.min(1, distanceInMeters(start, projected) / segmentLength))
    const match: RouteProgress = {
      distanceToRoute: projected.distance,
      nearestPoint: { lng: projected.lng, lat: projected.lat },
      segmentIndex: index,
      segmentProgress,
      distanceAlongRoute: distanceBeforeSegment + segmentLength * segmentProgress,
    }

    if (!bestMatch || match.distanceToRoute < bestMatch.distanceToRoute) {
      bestMatch = match
    }

    distanceBeforeSegment += segmentLength
  }

  return bestMatch
}

function getDeviationDirection(
  point: { lng: number; lat: number },
  polyline: Array<{ lng: number; lat: number }>,
  progress: RouteProgress | null,
) {
  if (!progress || polyline.length < 2) {
    return null
  }

  const start = polyline[progress.segmentIndex]
  const end = polyline[progress.segmentIndex + 1]
  if (!start || !end) {
    return null
  }

  const segmentLng = end.lng - start.lng
  const segmentLat = end.lat - start.lat
  const offsetLng = point.lng - progress.nearestPoint.lng
  const offsetLat = point.lat - progress.nearestPoint.lat
  const cross = segmentLng * offsetLat - segmentLat * offsetLng

  if (Math.abs(cross) < 1e-10) {
    return 'on-route'
  }

  return cross > 0 ? 'left' : 'right'
}

function buildStepCumulativeDistances(steps: RouteStep[]) {
  const cumulative: number[] = []
  let total = 0

  for (const step of steps) {
    total += Math.max(0, step.distance)
    cumulative.push(total)
  }

  return cumulative
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

const QUICK_TYPES = [
  { label: '全部', value: '' },
  { label: '景区', value: '110000' },
  { label: '校园', value: '141200' },
  { label: '地铁', value: '150500' },
  { label: '停车场', value: '150900' },
]

type InitialDestination = {
  name: string
  lng: number
  lat: number
}

export function RealWorldPoiSearch({ initialDestination }: { initialDestination?: InitialDestination | null }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const locationWatchIdRef = useRef<number | null>(null)
  const lastAutoRerouteAtRef = useRef<number>(0)
  const lastAutoPlanKeyRef = useRef<string>('')
  const lastRoutePayloadRef = useRef<RouteRequestPayload | null>(null)
  const stepListRef = useRef<HTMLDivElement | null>(null)
  const stepItemRefs = useRef<Array<HTMLDivElement | null>>([])
  const lastSpokenRouteKeyRef = useRef<string>('')
  const lastSpokenStepRef = useRef<string>('')
  const [keyword, setKeyword] = useState('')
  const [city, setCity] = useState('')
  const [types, setTypes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<Poi[]>([])
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null)
  const [manualStartPoi, setManualStartPoi] = useState<Poi | null>(null)
  const [preferManualStart, setPreferManualStart] = useState(false)
  const [routeMode, setRouteMode] = useState<RouteMode>('walking')
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState('')
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null)
  const [routeCandidates, setRouteCandidates] = useState<RoutePlan[]>([])
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const compareOverlaysRef = useRef<any[]>([])
  const [currentLocation, setCurrentLocation] = useState<{ lng: number; lat: number } | null>(null)
  const [autoPlanEnabled, setAutoPlanEnabled] = useState(true)
  const [followMode, setFollowMode] = useState<FollowMode>('locked')
  const [trackingEnabled, setTrackingEnabled] = useState(false)
  const [trackingError, setTrackingError] = useState('')
  const [deviationMeters, setDeviationMeters] = useState<number | null>(null)
  const [autoRerouteCount, setAutoRerouteCount] = useState(0)
  const [routeNotice, setRouteNotice] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState('')
  const [mapReloadToken, setMapReloadToken] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceError, setVoiceError] = useState('')

  useEffect(() => {
    if (!initialDestination) return
    const { name, lng, lat } = initialDestination
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return

    const prefilled: Poi = {
      id: `prefill-${name}`,
      name,
      type: '预设目的地',
      typeCode: 'prefill',
      city: '',
      district: '',
      address: '',
      latitude: lat,
      longitude: lng,
      provider: 'amap',
    }

    setKeyword(name)
    setSelectedPoi(prefilled)
    setAutoPlanEnabled(true)
    setRouteError('')
    setResults(previous => {
      const exists = previous.some(item => item.name === prefilled.name && item.longitude === prefilled.longitude && item.latitude === prefilled.latitude)
      if (exists) return previous
      return [prefilled, ...previous]
    })
    setRouteNotice(`已从地图带入目的地：${name}，已开启自动规划`)
  }, [initialDestination])

  const canSearch = useMemo(() => keyword.trim().length > 0, [keyword])
  const manualStartLocation = useMemo(() => {
    if (!manualStartPoi?.longitude || !manualStartPoi?.latitude) {
      return null
    }

    return {
      lng: manualStartPoi.longitude,
      lat: manualStartPoi.latitude,
    }
  }, [manualStartPoi])
  const planningOrigin = preferManualStart
    ? (manualStartLocation ?? currentLocation)
    : (currentLocation ?? manualStartLocation)
  const needsLocationForAutoPlan = autoPlanEnabled && !!selectedPoi && !planningOrigin
  const usingManualStart = !!manualStartLocation && (preferManualStart || !currentLocation)
  const routeProgress = useMemo(() => {
    if (!currentLocation || !routePlan?.polyline?.length) {
      return null
    }

    return getRouteProgress(currentLocation, routePlan.polyline)
  }, [currentLocation, routePlan])

  const deviationDirection = useMemo(() => {
    if (!currentLocation || !routePlan?.polyline?.length || !routeProgress || deviationMeters === null) {
      return null
    }

    return getDeviationDirection(currentLocation, routePlan.polyline, routeProgress)
  }, [currentLocation, deviationMeters, routePlan, routeProgress])

  const deviationDirectionLabel = useMemo(() => {
    if (!deviationDirection || deviationMeters === null) {
      return ''
    }

    if (deviationDirection === 'left') {
      return `你当前偏向路线左侧约 ${Math.round(deviationMeters)} 米`
    }

    if (deviationDirection === 'right') {
      return `你当前偏向路线右侧约 ${Math.round(deviationMeters)} 米`
    }

    return `你当前已基本贴近路线（约 ${Math.round(deviationMeters)} 米）`
  }, [deviationDirection, deviationMeters])

  const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const buildRouteSpeechText = (plan: RoutePlan) => {
    const summary = plan.summary
    const steps = plan.steps
      .map((s, i) => `第${i + 1}步，前往${s.instruction.replace(/\s+/g, '')}`)
      .join('。')

    return `路线已生成。总距离 ${Math.round(summary.distance)} 米，预计 ${formatDuration(summary.duration)}。${steps}`
  }

  const speakText = (text: string) => {
    if (!voiceSupported) {
      setVoiceError('当前浏览器不支持语音播报')
      return
    }

    try {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'zh-CN'
      utter.rate = 1
      utter.pitch = 1
      utter.onend = () => setVoiceError('')
      utter.onerror = () => setVoiceError(toFriendlyErrorMessage('voice error', 'voice'))
      window.speechSynthesis.speak(utter)
    } catch (e) {
      setVoiceError(toFriendlyErrorMessage(e instanceof Error ? e.message : 'voice init failed', 'voice'))
    }
  }

  const stopSpeech = () => {
    if (!voiceSupported) return
    window.speechSynthesis.cancel()
  }

  const recenterToCurrent = () => {
    const map = mapInstanceRef.current
    if (!map || !planningOrigin) {
      setRouteNotice('暂无可用起点，无法居中地图')
      return
    }

    map.setCenter([planningOrigin.lng, planningOrigin.lat])
    setFollowMode('locked')
    setRouteNotice('已切回锁定视角')
  }

  const stepCumulativeDistances = useMemo(() => {
    if (!routePlan?.steps?.length) {
      return []
    }

    return buildStepCumulativeDistances(routePlan.steps)
  }, [routePlan])

  const activeStepIndex = useMemo(() => {
    if (!routeProgress || !stepCumulativeDistances.length) {
      return 0
    }

    const routeDistance = routeProgress.distanceAlongRoute
    for (let index = 0; index < stepCumulativeDistances.length; index += 1) {
      if (routeDistance <= stepCumulativeDistances[index]) {
        return index
      }
    }

    return Math.max(stepCumulativeDistances.length - 1, 0)
  }, [routeProgress, stepCumulativeDistances])

  const nextStepIndex = Math.min(activeStepIndex + 1, Math.max((routePlan?.steps.length ?? 1) - 1, 0))
  const nextStep = routePlan?.steps[nextStepIndex] ?? null
  const currentStep = routePlan?.steps[activeStepIndex] ?? null
  const remainingDistanceMeters = useMemo(() => {
    if (!routeProgress || !routePlan?.summary?.distance) {
      return null
    }

    return Math.max(routePlan.summary.distance - routeProgress.distanceAlongRoute, 0)
  }, [routePlan, routeProgress])

  const routeStatusBanner = useMemo(() => {
    if (routeLoading) {
      return {
        tone: 'info' as const,
        title: '路线规划中',
        detail: '正在向高德请求最新路线，请稍候。',
      }
    }

    if (routeError) {
      return {
        tone: 'error' as const,
        title: '路线规划异常',
        detail: routeError,
      }
    }

    if (routePlan && routeNotice) {
      return {
        tone: 'success' as const,
        title: '路线状态已更新',
        detail: routeNotice,
      }
    }

    if (routePlan && trackingEnabled && deviationMeters !== null && deviationMeters > 0) {
      return {
        tone: 'info' as const,
        title: '导航进行中',
        detail: deviationDirectionLabel
          ? `${deviationDirectionLabel}，系统会自动监测并重算。`
          : `当前偏离路线约 ${Math.round(deviationMeters)} 米，系统会自动监测并重算。`,
      }
    }

    if (routePlan) {
      return {
        tone: 'success' as const,
        title: '路线已就绪',
        detail: routeCandidates.length > 1
          ? '你可以切换候选路线，或直接按步骤前进并开启实时跟随。'
          : '你可以直接按步骤前进，或开启实时跟随查看偏航重算。',
      }
    }

    if (needsLocationForAutoPlan) {
      return {
        tone: 'warning' as const,
        title: '等待定位授权',
        detail: '已选目的地且自动规划已开启，请点击下方按钮授权定位并开始规划。',
      }
    }

    if (selectedPoi) {
      return {
        tone: 'warning' as const,
        title: '已选中目的地',
        detail: usingManualStart
          ? '当前将使用手动起点规划，你也可以授权定位改为实时起点。'
          : '可直接点击“用当前位置开始规划”，或先开启实时跟随。',
      }
    }

    return {
      tone: 'neutral' as const,
      title: '等待目的地',
      detail: '请先从左侧搜索并选中一个真实地点。',
    }
  }, [deviationDirectionLabel, deviationMeters, needsLocationForAutoPlan, routeCandidates.length, routeError, routeLoading, routeNotice, routePlan, selectedPoi, trackingEnabled, usingManualStart])

  const routeStatusToneClass = routeStatusBanner.tone === 'error'
    ? 'border-red-300/40 bg-red-500/10 text-red-200'
    : routeStatusBanner.tone === 'success'
      ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-200'
      : routeStatusBanner.tone === 'warning'
        ? 'border-amber-300/40 bg-amber-500/10 text-amber-200'
        : routeStatusBanner.tone === 'info'
          ? 'border-cyan-300/40 bg-cyan-500/10 text-cyan-200'
          : 'border-slate-600 bg-slate-800 text-slate-200'

  useEffect(() => {
    const currentStepElement = stepItemRefs.current[activeStepIndex]
    if (!currentStepElement || !stepListRef.current) {
      return
    }

    currentStepElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }, [activeStepIndex, routePlan?.steps.length])

  useEffect(() => {
    if (!routeNotice) {
      return
    }

    const timer = window.setTimeout(() => {
      setRouteNotice('')
    }, 6000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [routeNotice])

  useEffect(() => {
    if (!voiceEnabled || !routePlan || !routePlan.steps.length) {
      return
    }

    const routeKey = `${routePlan.mode}:${routePlan.summary.distance}:${routePlan.summary.duration}`
    if (lastSpokenRouteKeyRef.current === routeKey) return
    lastSpokenRouteKeyRef.current = routeKey
    speakText(buildRouteSpeechText(routePlan))
  }, [voiceEnabled, routePlan])

  useEffect(() => {
    if (!voiceEnabled || !routePlan || !routePlan.steps.length) return
    const stepKey = `${routePlan.mode}:${routePlan.summary.distance}:${activeStepIndex}`
    if (lastSpokenStepRef.current === stepKey) return
    lastSpokenStepRef.current = stepKey
    const instruction = routePlan.steps[activeStepIndex]?.instruction ?? ''
    if (instruction) speakText(`第${activeStepIndex + 1}步：${instruction}`)
  }, [voiceEnabled, activeStepIndex, routePlan])

  useEffect(() => {
    return () => {
      stopSpeech()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function initMap() {
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

        if (!mapInstanceRef.current) {
          const map = new window.AMap.Map(mapContainerRef.current, {
            zoom: 12,
            center: [120.1551, 30.2741],
            viewMode: '2D',
            resizeEnable: true,
          })

          if (window.AMap.ToolBar) {
            map.addControl(new window.AMap.ToolBar())
          }
          if (window.AMap.Scale) {
            map.addControl(new window.AMap.Scale())
          }

          // 用户手动拖动时自动切到自由视角，避免被程序反复拉回。
          map.on('dragstart', () => {
            setFollowMode(previous => (previous === 'locked' ? 'free' : previous))
          })

          mapInstanceRef.current = map
        }

        setMapReady(true)
        setMapError('')
      } catch (error) {
        if (!cancelled) {
          const rawMessage = error instanceof Error ? error.message : '地图初始化失败'
          setMapError(toFriendlyErrorMessage(rawMessage, 'map'))
        }
      }
    }

    initMap()

    return () => {
      cancelled = true
    }
  }, [mapReloadToken])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !window.AMap || !mapReady) {
      return
    }

    map.clearMap()
    const overlays: any[] = []
    let cameraTarget: { lng: number; lat: number } | null = null

    if (planningOrigin) {
      const shouldUseLiveMarker = !!currentLocation && !usingManualStart
      const effectiveCurrentLocation = shouldUseLiveMarker
        ? (routeProgress?.nearestPoint ?? currentLocation)
        : planningOrigin
      cameraTarget = effectiveCurrentLocation
      const startMarker = new window.AMap.Marker({
        position: [effectiveCurrentLocation.lng, effectiveCurrentLocation.lat],
        title: shouldUseLiveMarker
          ? (routeProgress ? '当前位置（贴路）' : '当前位置')
          : '手动起点',
        content: `
          <div style="
            width: 18px;
            height: 18px;
            border-radius: 999px;
            border: 4px solid rgba(15,118,110,0.22);
            background: #0f766e;
            box-shadow: 0 0 0 6px rgba(15,118,110,0.16);
          "></div>
        `,
        offset: new window.AMap.Pixel(-9, -9),
      })
      overlays.push(startMarker)
    }

    if (selectedPoi?.longitude && selectedPoi?.latitude) {
      const destinationMarker = new window.AMap.Marker({
        position: [selectedPoi.longitude, selectedPoi.latitude],
        title: selectedPoi.name,
        content: `
          <div style="
            width: 20px;
            height: 20px;
            border-radius: 999px;
            border: 3px solid #fff;
            background: #f97316;
            box-shadow: 0 8px 16px rgba(15, 23, 42, 0.22);
          "></div>
        `,
        offset: new window.AMap.Pixel(-10, -10),
      })

      destinationMarker.setLabel({
        content: `<div style="padding:4px 8px;border-radius:999px;background:rgba(255,255,255,0.95);border:1px solid rgba(100,116,139,0.24);box-shadow:0 8px 16px rgba(15,23,42,0.08);font-size:12px;color:#334155;white-space:nowrap;">${selectedPoi.name}</div>`,
        direction: 'top',
      })

      overlays.push(destinationMarker)
    }

    if (routePlan?.polyline?.length) {
      const completedPath = routePlan.steps
        .slice(0, activeStepIndex)
        .flatMap(step => step.polyline)
      const currentPath = routePlan.steps[activeStepIndex]?.polyline ?? []
      const upcomingPath = routePlan.steps
        .slice(activeStepIndex + 1)
        .flatMap(step => step.polyline)

      const pushLine = (path: Array<{ lng: number; lat: number }>, options: { color: string; width: number; opacity: number; zIndex?: number }) => {
        if (path.length < 2) {
          return
        }

        const line = new window.AMap.Polyline({
          path: path.map(point => [point.lng, point.lat]),
          strokeColor: options.color,
          strokeWeight: options.width,
          strokeOpacity: options.opacity,
          lineJoin: 'round',
          lineCap: 'round',
          zIndex: options.zIndex ?? 20,
        })
        overlays.push(line)
      }

      pushLine(
        completedPath,
        {
          color: '#10b981',
          width: 6,
          opacity: 0.45,
          zIndex: 21,
        },
      )

      pushLine(
        currentPath,
        {
          color: routePlan.mode === 'walking' ? '#22c55e' : '#38bdf8',
          width: 9,
          opacity: 0.98,
          zIndex: 24,
        },
      )

      pushLine(
        upcomingPath,
        {
          color: routePlan.mode === 'walking' ? '#84cc16' : '#60a5fa',
          width: 6,
          opacity: 0.55,
          zIndex: 22,
        },
      )

      if (completedPath.length < 2 && currentPath.length < 2 && upcomingPath.length < 2) {
        pushLine(
          routePlan.polyline,
          {
            color: routePlan.mode === 'walking' ? '#16a34a' : '#2563eb',
            width: 7,
            opacity: 0.92,
            zIndex: 20,
          },
        )
      }
    }

    if (overlays.length > 0) {
      map.add(overlays)

      if (followMode === 'locked' && cameraTarget) {
        map.setCenter([cameraTarget.lng, cameraTarget.lat])
      } else if (!planningOrigin) {
        map.setFitView(overlays, false, [40, 40, 40, 40])
      }
    }
  }, [activeStepIndex, currentLocation, followMode, mapReady, planningOrigin, routePlan, routeProgress, selectedPoi, usingManualStart])

  useEffect(() => {
    if (!trackingEnabled) {
      if (locationWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current)
        locationWatchIdRef.current = null
      }
      return
    }

    if (!navigator.geolocation) {
      setTrackingError(toFriendlyErrorMessage('geolocation unsupported', 'tracking'))
      setTrackingEnabled(false)
      return
    }

    setTrackingError('')
    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      position => {
        setCurrentLocation({
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        })
      },
      error => {
        setTrackingError(toFriendlyErrorMessage(error.message || '定位跟随失败', 'tracking'))
        setTrackingEnabled(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000,
      },
    )

    return () => {
      if (locationWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current)
        locationWatchIdRef.current = null
      }
    }
  }, [trackingEnabled])

  const searchPois = async () => {
    if (!canSearch) {
      setError('请输入关键词，例如“景区”“校园”“西湖”“厦门大学”')
      return
    }

    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      params.set('q', keyword.trim())
      if (city.trim()) {
        params.set('city', city.trim())
      }
      if (types) {
        params.set('types', types)
      }

      const response = await fetch(`/api/real-world-poi-search?${params.toString()}`)
      const data = (await response.json()) as SearchResponse

      if (!response.ok) {
        throw new Error(data.message || data.error || '真实 POI 搜索失败')
      }

      setResults(data.pois || [])
      setSelectedPoi(data.pois?.[0] ?? null)
      setRoutePlan(null)
      setRouteCandidates([])
      setActiveRouteId(null)
      setRouteError('')
    } catch (searchError) {
      const rawMessage = searchError instanceof Error ? searchError.message : '真实 POI 搜索失败'
      setError(toFriendlyErrorMessage(rawMessage, 'search'))
      setResults([])
      setSelectedPoi(null)
    } finally {
      setLoading(false)
    }
  }

  const requestCurrentLocation = async () => {
    if (!navigator.geolocation) {
      throw new Error(toFriendlyErrorMessage('geolocation unsupported', 'location'))
    }

    return new Promise<{ lng: number; lat: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            lng: position.coords.longitude,
            lat: position.coords.latitude,
          })
        },
        geoError => {
          reject(new Error(toFriendlyErrorMessage(geoError.message || '定位失败', 'location')))
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
      )
    })
  }

  const requestRoutePlan = async (payload: RouteRequestPayload, fallbackMessage: string) => {
    const response = await fetch('/api/real-world-route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as RouteCollectionResponse
    if (!response.ok) {
      throw new Error(data.message || data.error || fallbackMessage)
    }

    return data
  }

  const normalizeRouteCandidates = (data: RouteCollectionResponse) => {
    return (data.routes?.length ? data.routes : [data]).map(candidate => ({
      ...candidate,
      reason: candidate.reason || (candidate.id === data.activeRouteId ? '当前默认选择的路线。' : candidate.label),
    }))
  }

  const applyRouteCollection = (data: RouteCollectionResponse, notice: string) => {
    const candidates = normalizeRouteCandidates(data)
    const activeId = data.activeRouteId || candidates[0]?.id || null
    const selectedRoute = candidates.find(candidate => candidate.id === activeId) || candidates[0] || null

    setRouteCandidates(candidates)
    setActiveRouteId(activeId)
    setRoutePlan(selectedRoute)
    setRouteNotice(notice)
  }

  const switchRouteCandidate = (candidate: RoutePlan) => {
    setRoutePlan(candidate)
    setActiveRouteId(candidate.id)
    setRouteNotice(`已切换到${candidate.label}路线`)
  }

  const openCompare = () => {
    setCompareOpen(true)
  }

  const closeCompare = () => {
    setCompareOpen(false)
  }

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !compareOpen) return

    // 清理旧覆盖
    if (compareOverlaysRef.current?.length) {
      try { map.remove(compareOverlaysRef.current) } catch (e) {}
      compareOverlaysRef.current = []
    }

    const palette = ['#2563eb', '#f97316', '#10b981', '#a78bfa']
    const overlays: any[] = []
    routeCandidates.forEach((candidate, idx) => {
      if (!candidate.polyline || candidate.polyline.length < 2) return
      const color = palette[idx % palette.length]
      const line = new window.AMap.Polyline({
        path: candidate.polyline.map(p => [p.lng, p.lat]),
        strokeColor: color,
        strokeWeight: 6,
        strokeOpacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: 300 + idx,
      })
      overlays.push(line)
    })

    if (overlays.length) {
      map.add(overlays)
      compareOverlaysRef.current = overlays
      map.setFitView(overlays, false, [40, 40, 40, 40])
    }

    return () => {
      if (compareOverlaysRef.current?.length) {
        try { map.remove(compareOverlaysRef.current) } catch (e) {}
        compareOverlaysRef.current = []
      }
    }
  }, [compareOpen, routeCandidates])

  const retryRoutePlan = async () => {
    if (routeLoading) {
      return
    }

    if (!lastRoutePayloadRef.current) {
      await handlePlanRoute()
      return
    }

    setRouteLoading(true)
    setRouteError('')
    setRouteCandidates([])
    setActiveRouteId(null)

    try {
      const data = await requestRoutePlan(lastRoutePayloadRef.current, '路线重试失败')
      applyRouteCollection(data, '重试成功，路线已更新')
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '路线重试失败'
      setRouteError(toFriendlyErrorMessage(rawMessage, 'route'))
    } finally {
      setRouteLoading(false)
    }
  }

  const retryMapLoad = () => {
    setMapError('')
    setMapReady(false)
    if (mapInstanceRef.current && typeof mapInstanceRef.current.destroy === 'function') {
      mapInstanceRef.current.destroy()
      mapInstanceRef.current = null
    }
    setMapReloadToken(previous => previous + 1)
  }

  const retryTracking = () => {
    setTrackingError('')
    setTrackingEnabled(false)
    window.setTimeout(() => {
      setTrackingEnabled(true)
    }, 0)
  }

  const WALKING_MAX_DISTANCE_METERS = 30_000 // 30km

  const handlePlanRoute = async () => {
    if (!selectedPoi?.longitude || !selectedPoi?.latitude) {
      setRouteError('请先选中一个可用坐标的目的地')
      return
    }

    setRouteLoading(true)
    setRouteError('')
    setRouteNotice('')
    setRouteCandidates([])
    setActiveRouteId(null)

    try {
      let origin = planningOrigin
      if (!origin) {
        origin = await requestCurrentLocation()
        setCurrentLocation(origin)
      }

      if (selectedPoi.longitude === origin.lng && selectedPoi.latitude === origin.lat) {
        setRouteError('起点和终点相同，请选择不同的目的地后再规划')
        setRouteLoading(false)
        return
      }

      // 步行模式下检查直线距离是否过远
      if (routeMode === 'walking') {
        const directDistance = distanceInMeters(origin, {
          lng: selectedPoi.longitude!,
          lat: selectedPoi.latitude!,
        })
        if (directDistance > WALKING_MAX_DISTANCE_METERS) {
          setRouteError('起终点直线距离超过 30 公里，不推荐步行，请切换到驾车模式再规划路线')
          setRouteLoading(false)
          return
        }
      }

      const payload: RouteRequestPayload = {
        mode: routeMode,
        origin,
        destination: {
          lng: selectedPoi.longitude!,
          lat: selectedPoi.latitude!,
        },
      }
      lastRoutePayloadRef.current = payload

      const data = await requestRoutePlan(payload, '真实路线规划失败')

      applyRouteCollection(data, '路线摘要已更新')
    } catch (planError) {
      setRoutePlan(null)
      setRouteCandidates([])
      setActiveRouteId(null)
      const rawMessage = planError instanceof Error ? planError.message : '真实路线规划失败'
      setRouteError(toFriendlyErrorMessage(rawMessage, 'route'))
    } finally {
      setRouteLoading(false)
    }
  }

  const replanFromCurrent = async (origin: { lng: number; lat: number }) => {
    if (!selectedPoi?.longitude || !selectedPoi?.latitude) {
      return
    }

    setRouteLoading(true)
    setRouteError('')
    setRouteCandidates([])
    setActiveRouteId(null)

    try {
      const payload: RouteRequestPayload = {
        mode: routeMode,
        origin,
        destination: {
          lng: selectedPoi.longitude,
          lat: selectedPoi.latitude,
        },
      }
      lastRoutePayloadRef.current = payload
      const data = await requestRoutePlan(payload, '偏航重算失败')
      applyRouteCollection(data, '检测到偏航，已自动重新规划路线')
      setAutoRerouteCount(previous => previous + 1)
    } catch (error) {
      setRoutePlan(null)
      setRouteCandidates([])
      setActiveRouteId(null)
      const rawMessage = error instanceof Error ? error.message : '偏航重算失败'
      setRouteError(toFriendlyErrorMessage(rawMessage, 'route'))
    } finally {
      setRouteLoading(false)
    }
  }

  useEffect(() => {
    if (!trackingEnabled || !currentLocation || !routePlan?.polyline?.length || !selectedPoi) {
      return
    }

    const nearestDistance = distanceToRoute(currentLocation, routePlan.polyline)
    if (!Number.isFinite(nearestDistance)) {
      return
    }

    setDeviationMeters(nearestDistance)

    const threshold = routeMode === 'driving'
      ? DRIVING_DEVIATION_THRESHOLD_METERS
      : WALKING_DEVIATION_THRESHOLD_METERS

    if (nearestDistance <= threshold || routeLoading) {
      return
    }

    const now = Date.now()
    if (now - lastAutoRerouteAtRef.current < AUTO_REROUTE_COOLDOWN_MS) {
      return
    }

    lastAutoRerouteAtRef.current = now
    void replanFromCurrent(currentLocation)
  }, [currentLocation, routeLoading, routeMode, routePlan, selectedPoi, trackingEnabled])

  useEffect(() => {
    if (!autoPlanEnabled || !selectedPoi?.longitude || !selectedPoi?.latitude || !planningOrigin || routeLoading) {
      return
    }

    const autoPlanKey = `${selectedPoi.id}:${routeMode}:${planningOrigin.lng.toFixed(5)},${planningOrigin.lat.toFixed(5)}`
    if (lastAutoPlanKeyRef.current === autoPlanKey) {
      return
    }
    lastAutoPlanKeyRef.current = autoPlanKey

    void (async () => {
      try {
        const payload: RouteRequestPayload = {
          mode: routeMode,
          origin: planningOrigin,
          destination: {
            lng: selectedPoi.longitude!,
            lat: selectedPoi.latitude!,
          },
        }
        lastRoutePayloadRef.current = payload
        const data = await requestRoutePlan(payload, '自动规划失败')

        applyRouteCollection(data, '已根据当前定位自动准备路线摘要')
        setRouteError('')
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : '自动规划失败'
        setRouteError(toFriendlyErrorMessage(rawMessage, 'route'))
      }
    })()
  }, [autoPlanEnabled, planningOrigin, routeLoading, routeMode, selectedPoi])

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            <Sparkles className="h-4 w-4" />
            真实 POI 搜索
          </div>
          <h3 className="mt-2 text-lg font-bold text-slate-900">搜索景区、校园或入口地点</h3>
          <p className="mt-1 text-sm text-slate-500">
            这一步直接从高德拉取真实地点，后续路线规划会直接接到这里的选中结果。
          </p>
        </div>

        <div className="relative h-[360px] border-b border-slate-200 bg-slate-100">
          <div ref={mapContainerRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
          {!mapReady && !mapError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 text-slate-600">
              <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-lg">
                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                正在初始化真实地图...
              </div>
            </div>
          ) : null}
          {mapError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50/95 px-6 text-center text-red-700">
              <div>
                <p className="text-lg font-semibold">地图加载失败</p>
                <p className="mt-2 text-sm">{mapError}</p>
                <button
                  type="button"
                  onClick={retryMapLoad}
                  className="mt-3 inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                >
                  重试加载地图
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">关键词</span>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 focus-within:border-teal-500">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={keyword}
                  onChange={event => setKeyword(event.target.value)}
                  placeholder="例如：西湖、厦门大学、景区、博物馆"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">城市（可选）</span>
              <input
                value={city}
                onChange={event => setCity(event.target.value)}
                placeholder="例如：杭州、厦门"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-teal-500"
              />
            </label>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">类型筛选</div>
            <div className="flex flex-wrap gap-2">
              {QUICK_TYPES.map(option => (
                <button
                  key={option.value || 'all'}
                  type="button"
                  onClick={() => setTypes(option.value)}
                  className={`rounded-full px-4 py-2 text-sm transition ${types === option.value ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={searchPois}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {loading ? '搜索中...' : '搜索真实地点'}
          </button>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div>{error}</div>
              <button
                type="button"
                onClick={searchPois}
                disabled={loading}
                className="mt-2 inline-flex items-center rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                重试搜索
              </button>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
              搜索结果 {results.length > 0 ? `(${results.length})` : ''}
            </div>
            <div className="max-h-[520px] divide-y divide-slate-200 overflow-auto">
              {results.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500">
                  先输入关键词再搜索。支持景区、校园、地铁、停车场等真实地点。
                </div>
              ) : (
                results.map(poi => {
                  const isSelected = selectedPoi?.id === poi.id
                  const isManualStart = manualStartPoi?.id === poi.id
                  return (
                    <div key={poi.id} className={`px-4 py-4 transition ${isSelected ? 'bg-teal-50' : 'bg-white hover:bg-slate-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedPoi(poi)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-slate-900">{poi.name}</span>
                            {isSelected ? <Check className="h-4 w-4 flex-shrink-0 text-teal-600" /> : null}
                            {isManualStart ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">起点</span> : null}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {poi.city || '未知城市'} · {poi.district || '未知区域'}
                          </div>
                          <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                            {poi.address || poi.type || '无地址信息'}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!poi.longitude || !poi.latitude) {
                              return
                            }
                            setManualStartPoi(poi)
                            setPreferManualStart(true)
                            lastAutoPlanKeyRef.current = ''
                            setRouteError('')
                            // If this POI is already the destination, clear it to avoid same-point error
                            if (selectedPoi?.id === poi.id) {
                              setSelectedPoi(null)
                              setRouteNotice('已设为起点，请另外选择一个不同的目的地')
                            } else {
                              setRouteNotice('已设置手动起点，可直接开始规划')
                            }
                          }}
                          disabled={!poi.longitude || !poi.latitude}
                          className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          设为起点
                        </button>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPoi(poi)}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${isSelected ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                        >
                          {isSelected ? '当前终点' : '设为终点'}
                        </button>
                        {isManualStart ? (
                          <button
                            type="button"
                            onClick={() => {
                              setManualStartPoi(null)
                              setPreferManualStart(false)
                              lastAutoPlanKeyRef.current = ''
                            }}
                            className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-300"
                          >
                            取消起点
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-slate-900 px-6 py-5 text-sm text-slate-200 shadow-lg">
        <div className="font-semibold text-white">真实路线规划</div>

        <div className={`mt-3 rounded-2xl border px-4 py-3 text-xs leading-6 ${routeStatusToneClass}`}>
          <div className="font-semibold">{routeStatusBanner.title}</div>
          <div className="mt-1">{routeStatusBanner.detail}</div>
        </div>

        {needsLocationForAutoPlan ? (
          <div className="mt-3 rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            <div className="font-semibold">自动规划引导</div>
            <div className="mt-1 leading-6">
              检测到你已选中目标，但还没有当前位置。点击下方按钮即可一次完成授权并启动路线规划。
            </div>
            <button
              type="button"
              onClick={handlePlanRoute}
              disabled={routeLoading || !selectedPoi}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              {routeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              {routeLoading ? '授权与规划中...' : '一键授权并开始规划'}
            </button>
          </div>
        ) : null}

        <div className="mt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">视角模式</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setFollowMode('locked')
                recenterToCurrent()
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${followMode === 'locked' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              锁定视角
            </button>
            <button
              type="button"
              onClick={() => {
                setFollowMode('free')
                setRouteNotice('已切换为自由拖动视角')
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${followMode === 'free' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              自由拖动
            </button>
          </div>
          <button
            type="button"
            onClick={recenterToCurrent}
            className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            回到起点位置
          </button>

          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">路线方式</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRouteMode('walking')}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${routeMode === 'walking' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              <Footprints className="h-3.5 w-3.5" />
              步行
            </button>
            <button
              type="button"
              onClick={() => setRouteMode('driving')}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${routeMode === 'driving' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              <Car className="h-3.5 w-3.5" />
              驾车
            </button>
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={autoPlanEnabled}
              onChange={event => {
                setAutoPlanEnabled(event.target.checked)
                lastAutoPlanKeyRef.current = ''
              }}
              className="mt-0.5"
            />
            <span>选中目的地后自动准备路线摘要（需要可用起点）</span>
          </label>
          <label
            className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300"
            title="勾选后使用浏览器语音播报路线摘要与逐步指示；默认关闭。移动端请确保允许网站播放声音。"
            htmlFor="voiceEnabled"
            aria-describedby="voiceTip"
          >
            <input
              id="voiceEnabled"
              type="checkbox"
              checked={voiceEnabled}
              onChange={event => setVoiceEnabled(event.target.checked)}
              {...(voiceSupported ? {} : { disabled: true })}
              className="mt-0.5 h-4 w-4 cursor-pointer"
            />
            <div className="flex items-center gap-2">
              <span className="select-none">语音逐步引导</span>
              <span className="text-xs text-slate-400">（默认关闭）</span>
            </div>
            <button
              type="button"
              className="ml-auto rounded-full p-1 text-slate-400 hover:text-slate-200"
              title="勾选后会用语音播报路线摘要与每一步的导航提示。若浏览器不支持或静音，将回退为文本提示。"
              aria-label="语音说明"
              onClick={e => e.preventDefault()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15a1 1 0 110 2 1 1 0 010-2zm1-9h-2v6h2V8z" fill="currentColor" />
              </svg>
            </button>
          </label>
          <div id="voiceTip" className="sr-only">
            勾选后会使用浏览器语音播报路线摘要与逐步指示；若浏览器不支持语音或被静音，将仅显示文本提示。移动端请允许页面播放声音。
          </div>
          {voiceError ? <div className="mt-2 text-xs text-red-300">{voiceError}</div> : null}
          <div className="mt-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300">
            起点来源：
            <span className="ml-1 font-semibold text-white">
              {usingManualStart
                ? `手动起点（${manualStartPoi?.name || '已设置'}）`
                : currentLocation
                ? '实时定位'
                : manualStartPoi
                  ? `手动起点（${manualStartPoi.name}）`
                  : '尚未确定'}
            </span>
            {currentLocation && manualStartPoi ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreferManualStart(false)
                    lastAutoPlanKeyRef.current = ''
                    setRouteNotice('已切换为定位起点优先')
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${!preferManualStart ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                >
                  定位优先
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreferManualStart(true)
                    lastAutoPlanKeyRef.current = ''
                    setRouteNotice('已切换为手动起点优先')
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${preferManualStart ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                >
                  手动起点优先
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={handlePlanRoute}
          disabled={routeLoading || !selectedPoi}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          {routeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
          {routeLoading ? '规划中...' : usingManualStart ? '用手动起点开始规划' : '用当前位置开始规划'}
        </button>

        <button
          type="button"
          onClick={() => setTrackingEnabled(previous => !previous)}
          className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${trackingEnabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-800 text-slate-100 hover:bg-slate-700'}`}
        >
          <MapPin className="h-4 w-4" />
          {trackingEnabled ? '关闭实时跟随与偏航重算' : '开启实时跟随与偏航重算'}
        </button>

        {routeError ? (
          <div className="mt-3 rounded-2xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-xs leading-6 text-red-200">
            <div>{routeError}</div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={retryRoutePlan}
                disabled={routeLoading || !selectedPoi}
                className="inline-flex items-center rounded-lg border border-red-300/40 bg-red-500/20 px-3 py-1 font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {routeLoading ? '重试中...' : '重试规划'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRouteError('')
                  setRouteNotice('你可以调整起点后重新规划')
                }}
                className="inline-flex items-center rounded-lg border border-slate-500 bg-slate-700/50 px-3 py-1 font-semibold text-slate-100 transition hover:bg-slate-700"
              >
                稍后再试
              </button>
            </div>
          </div>
        ) : null}

        {trackingError ? (
          <div className="mt-3 rounded-2xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-xs leading-6 text-red-200">
            <div>{trackingError}</div>
            <button
              type="button"
              onClick={retryTracking}
              className="mt-2 inline-flex items-center rounded-lg border border-red-300/40 bg-red-500/20 px-3 py-1 font-semibold text-red-100 transition hover:bg-red-500/30"
            >
              重新开启跟随
            </button>
          </div>
        ) : null}

        <div className="mt-5 font-semibold text-white">{selectedPoi ? selectedPoi.name : '选中目的地'}</div>
        {selectedPoi ? (
          <>
            <div className="mt-2 space-y-2">
              <div className="text-xs text-slate-400">
                {selectedPoi.city || ''}{selectedPoi.district ? ` · ${selectedPoi.district}` : ''}
              </div>
              {selectedPoi.address ? (
                <div className="text-xs text-slate-500">{selectedPoi.address}</div>
              ) : null}
            </div>

        {routePlan ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">路线摘要</div>
                    <div className="mt-1 text-xs text-slate-400">
                      当前路线：<span className="font-semibold text-cyan-300">{routePlan.label}</span>
                    </div>
                  </div>
                  {routeCandidates.length > 1 ? (
                    <div className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                      可切换 {routeCandidates.length} 条
                    </div>
                  ) : null}
                </div>
                {routePlan.reason ? (
                  <div className="mt-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs leading-6 text-slate-300">
                    {routePlan.reason}
                  </div>
                ) : null}
                <div className="mt-3 grid gap-2">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> 距离</span>
                    <span className="font-semibold text-white">{Math.round(routePlan.summary.distance)} m</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> 预计时间</span>
                    <span className="font-semibold text-white">{formatDuration(routePlan.summary.duration)}</span>
                  </div>
                  {routePlan.summary.trafficLights ? (
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span>红绿灯</span>
                      <span className="font-semibold text-white">{routePlan.summary.trafficLights}</span>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">当前步骤</span>
                    <span className="font-semibold text-white">{currentStep ? currentStep.instruction : '等待路线'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">下一步骤</span>
                    <span className="font-semibold text-white">{nextStep ? nextStep.instruction : '已到达终点'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">剩余距离</span>
                    <span className="font-semibold text-white">
                      {remainingDistanceMeters !== null ? `${Math.round(remainingDistanceMeters)} m` : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">步骤数</span>
                    <span className="font-semibold text-white">{routePlan.steps.length}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4 text-xs leading-6 text-slate-300">
                选择目的地后点击“用当前位置开始规划”，即可得到真实地图路线和步骤。
              </div>
            )}

            {routeCandidates.length > 1 ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">候选路线</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openCompare}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-600"
                    >
                      对比路线
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-400">点击任一路线即可切换地图、步骤和导航播报的当前路线。</div>
                <div className="mt-3 space-y-2">
                  {routeCandidates.map(candidate => {
                    const isActive = activeRouteId === candidate.id
                    const durationMinutes = Math.max(1, Math.round(candidate.summary.duration / 60))
                    const distanceMeters = Math.round(candidate.summary.distance)

                    return (
                      <div
                        key={candidate.id}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${isActive ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-slate-700 bg-slate-900/70 hover:bg-slate-800'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => switchRouteCandidate(candidate)}
                              className="w-full text-left"
                            >
                              <div className="text-sm font-semibold text-white">
                                {candidate.label}
                                {isActive ? <span className="ml-2 rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-200">当前选择</span> : null}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                {durationMinutes} 分钟 · {distanceMeters} m
                                {typeof candidate.summary.trafficLights === 'number' ? ` · ${candidate.summary.trafficLights} 个红绿灯` : ''}
                              </div>
                              <div className="mt-2 text-xs leading-6 text-slate-300">{candidate.reason}</div>
                            </button>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <button
                              type="button"
                              onClick={() => switchRouteCandidate(candidate)}
                              className="text-[11px] font-semibold text-cyan-200"
                            >
                              {isActive ? '已激活' : '切换'}
                            </button>
                            <button
                              type="button"
                              onClick={openCompare}
                              className="rounded-full px-2 py-1 text-[11px] font-semibold bg-slate-700 text-slate-200 hover:bg-slate-600"
                            >
                              详细对比
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {routePlan?.steps.length ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-sm font-semibold text-white">导航步骤</div>
                <div ref={stepListRef} className="mt-3 max-h-[320px] space-y-2 overflow-auto pr-1">
                  {routePlan.steps.map((step, index) => (
                    <div
                      key={`${step.instruction}-${index}`}
                      ref={element => {
                        stepItemRefs.current[index] = element
                      }}
                      className={`rounded-xl border px-3 py-2 ${index < activeStepIndex ? 'border-emerald-500/30 bg-emerald-500/10' : index === activeStepIndex ? 'border-teal-400/40 bg-teal-500/10' : index === nextStepIndex ? 'border-orange-400/40 bg-orange-500/10' : 'border-slate-700 bg-slate-900/70'}`}
                    >
                      <div className="text-xs font-semibold text-slate-200">
                        {index + 1}. {step.instruction}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {step.road || '道路信息缺失'} · {Math.round(step.distance)}m · {Math.round(step.duration)}s
                      </div>
                      {index === activeStepIndex ? (
                        <div className="mt-1 text-[11px] font-semibold text-teal-300">当前所在步骤</div>
                      ) : null}
                      {index === nextStepIndex && nextStepIndex !== activeStepIndex ? (
                        <div className="mt-1 text-[11px] font-semibold text-orange-300">下一导航步骤</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            </>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-800 p-4 text-sm leading-6 text-slate-300">
            先搜索并选中一个真实地点，后续路线规划才有目标点。
          </div>
        )}
      </aside>

      {compareOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeCompare} />
          <div className="relative z-10 w-[860px] max-w-[92%] rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-sm font-semibold">候选路线对比</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={closeCompare} className="text-sm text-slate-600">关闭</button>
              </div>
            </div>
            <div className="p-4">
              <div className="mb-3 text-xs text-slate-500">下方展示每条候选路线的核心指标及理由，并在地图上以不同颜色高亮。</div>
              <div className="mb-4 grid grid-cols-3 gap-4">
                {routeCandidates.map((c, idx) => (
                  <div key={c.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{c.label}</div>
                      <div className="text-xs text-slate-500">{idx + 1}</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">距离：<span className="font-semibold text-slate-900">{Math.round(c.summary.distance)} m</span></div>
                    <div className="mt-1 text-xs text-slate-600">预计：<span className="font-semibold text-slate-900">{formatDuration(c.summary.duration)}</span></div>
                    {typeof c.summary.trafficLights === 'number' ? <div className="mt-1 text-xs text-slate-600">红绿灯：<span className="font-semibold text-slate-900">{c.summary.trafficLights}</span></div> : null}
                    <div className="mt-2 text-xs text-slate-500">{c.reason}</div>
                  </div>
                ))}
              </div>
              <div className="mb-2 text-xs font-semibold">图例</div>
              <div className="flex flex-wrap gap-3">
                {routeCandidates.map((c, idx) => (
                  <div key={`legend-${c.id}`} className="flex items-center gap-2 text-xs">
                    <span style={{ width: 20, height: 8, background: ['#2563eb', '#f97316', '#10b981', '#a78bfa'][idx % 4], display: 'inline-block', borderRadius: 2 }} />
                    <span className="text-slate-700">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}