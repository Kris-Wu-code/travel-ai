/**
 * 导航搜索组件
 * 提供路由查询和多点访问规划功能
 */

'use client'

import { useState, useEffect } from 'react'
import { Loader2, MapPin, Clock, Navigation } from 'lucide-react'

interface POI {
  id: string
  name: string
  type: string
  floor?: number | null
  location?: { lat: number; lng: number }
}

interface RouteResult {
  distance: number
  totalDistance?: number
  estimatedTime: number
  path: string[]
  pathDetails: POI[]
  optimizationAlgorithm?: string
}

export function NavigationSearch({ sceneId }: { sceneId: string }) {
  const [pois, setPois] = useState<POI[]>([])
  const [startPoi, setStartPoi] = useState<string>('')
  const [endPoi, setEndPoi] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RouteResult | null>(null)
  const [error, setError] = useState<string>('')

  // 加载 POI 列表
  useEffect(() => {
    const fetchPois = async () => {
      try {
        const response = await fetch(
          `/api/navigation?action=graph-info&sceneId=${sceneId}`,
        )
        const data = await response.json()
        setPois(data.pois || [])
      } catch (err) {
        setError('加载 POI 失败')
        console.error(err)
      }
    }

    fetchPois()
  }, [sceneId])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(
        `/api/navigation?action=shortest-path&sceneId=${sceneId}&startId=${startPoi}&endId=${endPoi}`,
      )

      if (!response.ok) {
        throw new Error('路由查询失败')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">🗺️ 导航搜索</h2>

      {/* 搜索表单 */}
      <form onSubmit={handleSearch} className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">起点</label>
            <select
              value={startPoi}
              onChange={e => setStartPoi(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">请选择起点</option>
              {pois.map(poi => (
                <option key={poi.id} value={poi.id}>
                  {poi.name} ({poi.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">终点</label>
            <select
              value={endPoi}
              onChange={e => setEndPoi(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">请选择终点</option>
              {pois.map(poi => (
                <option key={poi.id} value={poi.id}>
                  {poi.name} ({poi.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !startPoi || !endPoi}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? '搜索中...' : '查询路由'}
        </button>
      </form>

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md mb-6">
          {error}
        </div>
      )}

      {/* 路由结果 */}
      {result && (
        <div className="space-y-4 bg-gray-50 p-6 rounded-lg">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Navigation className="w-5 h-5 text-blue-500" />
            最优路线已找到
          </div>

          {/* 距离和时间 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500">
              <div className="text-sm text-gray-600">距离</div>
              <div className="text-2xl font-bold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-500" />
                {result.distance} m
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
              <div className="text-sm text-gray-600">估计时间</div>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-500" />
                {Math.round(result.estimatedTime)}s
              </div>
            </div>
          </div>

          {/* 路线详情 */}
          <div className="bg-white p-4 rounded-lg">
            <h3 className="font-semibold mb-3">路线详情</h3>
            <div className="space-y-2">
              {result.pathDetails.map((poi, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{poi.name}</div>
                    <div className="text-xs text-gray-500">{poi.type}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 路线路径（简化版） */}
          <div className="bg-white p-4 rounded-lg">
            <h3 className="font-semibold mb-3">路径序列</h3>
            <div className="text-sm text-center text-gray-600 break-words">
              {result.pathDetails.map(poi => poi.name).join(' → ')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * TSP 多点规划组件
 */
export function MultiPointPlanner({ sceneId }: { sceneId: string }) {
  const [pois, setPois] = useState<POI[]>([])
  const [selectedPois, setSelectedPois] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RouteResult | null>(null)
  const [error, setError] = useState<string>('')

  // 加载 POI 列表
  useEffect(() => {
    const fetchPois = async () => {
      try {
        const response = await fetch(
          `/api/navigation?action=graph-info&sceneId=${sceneId}`,
        )
        const data = await response.json()
        setPois(data.pois || [])
      } catch (err) {
        setError('加载 POI 失败')
        console.error(err)
      }
    }

    fetchPois()
  }, [sceneId])

  const handlePlanRoute = async () => {
    if (selectedPois.length < 3) {
      setError('请至少选择 3 个 POI')
      return
    }

    setError('')
    setLoading(true)

    try {
      const response = await fetch(
        `/api/navigation?action=tsp&sceneId=${sceneId}&poiIds=${selectedPois.join(',')}`,
      )

      if (!response.ok) {
        throw new Error('TSP 规划失败')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生错误')
    } finally {
      setLoading(false)
    }
  }

  const togglePoi = (poiId: string) => {
    setSelectedPois(prev =>
      prev.includes(poiId) ? prev.filter(id => id !== poiId) : [...prev, poiId],
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">🎯 多点规划 (TSP)</h2>

      {/* POI 选择 */}
      <div className="mb-6">
        <label className="block font-medium mb-3">选择 POI（至少 3 个）</label>
        <div className="space-y-2">
          {pois.map(poi => (
            <label key={poi.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded">
              <input
                type="checkbox"
                checked={selectedPois.includes(poi.id)}
                onChange={() => togglePoi(poi.id)}
                className="w-4 h-4"
              />
              <span>{poi.name}</span>
              <span className="text-xs text-gray-500">({poi.type})</span>
            </label>
          ))}
        </div>
      </div>

      {/* 参数显示 */}
      {selectedPois.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded text-sm">
          已选择 {selectedPois.length} 个 POI
        </div>
      )}

      {/* 规划按钮 */}
      <button
        onClick={handlePlanRoute}
        disabled={loading || selectedPois.length < 3}
        className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 flex items-center justify-center gap-2 mb-6"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? '规划中...' : '生成最优访问顺序'}
      </button>

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md mb-6">
          {error}
        </div>
      )}

      {/* 规划结果 */}
      {result && (
        <div className="space-y-4 bg-gray-50 p-6 rounded-lg">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Navigation className="w-5 h-5 text-green-500" />
            最优访问顺序已生成
          </div>

          {/* 距离和时间 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
              <div className="text-sm text-gray-600">总距离</div>
              <div className="text-2xl font-bold">
                {(result.totalDistance ?? result.distance).toFixed(0)} m
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border-l-4 border-purple-500">
              <div className="text-sm text-gray-600">估计总时间</div>
              <div className="text-2xl font-bold">
                {Math.round(result.estimatedTime)}s
              </div>
            </div>
          </div>

          {/* 访问顺序 */}
          <div className="bg-white p-4 rounded-lg">
            <h3 className="font-semibold mb-3">访问顺序</h3>
            <div className="space-y-2">
              {result.pathDetails.map((poi, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{poi.name}</div>
                    <div className="text-xs text-gray-500">{poi.type}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 算法信息 */}
          <div className="text-xs text-gray-500 text-center p-3 bg-white rounded">
            使用 {result.optimizationAlgorithm} 算法优化
          </div>
        </div>
      )}
    </div>
  )
}
