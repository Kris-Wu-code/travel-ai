import Link from 'next/link'
import { createAdminClient } from '@/app/lib/supabase'
import { AmapNavigationShell } from '@/app/components/AmapNavigationShell'
import { RealWorldPoiSearch } from '@/app/components/RealWorldPoiSearch'

export const metadata = {
  title: '导航系统 | Travel AI',
  description: '最短路径规划和多点访问优化',
}

type NavigationMode = 'scene' | 'real-world'

const NAVIGATION_MODES: Array<{
  id: NavigationMode
  title: string
  description: string
  href: string
}> = [
  {
    id: 'scene',
    title: '场内导航',
    description: '保留当前校园 / 景区内部图结构路线，适合楼层、馆区和园区内部路径。',
    href: '?mode=scene',
  },
  {
    id: 'real-world',
    title: '真实地图导航',
    description: '基于高德真实 POI 和路线服务，面向景区、校园入口、停车场和周边道路。',
    href: '?mode=real-world',
  },
]

type SceneOption = {
  id: string
  name: string
  scene_type: string
  city: string | null
  description: string | null
  poiCount: number | null
}

async function getActiveScenes(): Promise<SceneOption[]> {
  try {
    const supabase = createAdminClient()
    const { data: scenesData } = await supabase
      .from('scenes')
      .select('id, name, scene_type, city, description')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!scenesData?.length) return []

    const { data: poiData } = await supabase
      .from('poi_items')
      .select('scene_id')
      .eq('status', 'approved')

    const poiCountMap = new Map<string, number>()
    for (const item of (poiData ?? [])) {
      if (!item.scene_id) continue
      poiCountMap.set(item.scene_id, (poiCountMap.get(item.scene_id) ?? 0) + 1)
    }

    return (scenesData as any[]).map(s => ({
      id: s.id,
      name: s.name,
      scene_type: s.scene_type,
      city: s.city,
      description: s.description,
      poiCount: poiCountMap.get(s.id) ?? null,
    }))
  } catch {
    return []
  }
}

export default async function NavigationPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; scene?: string; destName?: string; destLng?: string; destLat?: string; lat?: string; lng?: string }>
}) {
  const resolved = searchParams ? await searchParams : undefined
  const activeMode: NavigationMode = resolved?.mode === 'real-world' ? 'real-world' : 'scene'
  const activeModeConfig = NAVIGATION_MODES.find(m => m.id === activeMode) ?? NAVIGATION_MODES[0]

  // Resolve scene ID from URL param
  const urlSceneId = resolved?.scene?.trim() || ''
  const sceneId = urlSceneId

  // Fetch all active scenes for the picker (when no specific scene is selected)
  const activeScenes = activeMode === 'scene' && !sceneId ? await getActiveScenes() : []

  // Handle destination from two sources:
  //   1) destName/destLng/destLat (from campus-map-panel, global-search)
  //   2) lat/lng (from scenes/[id] detail page)
  const rawDestName = resolved?.destName?.trim() || ''
  const rawDestLng = Number(resolved?.destLng || resolved?.lng || '')
  const rawDestLat = Number(resolved?.destLat || resolved?.lat || '')
  const initialDestination = rawDestName && Number.isFinite(rawDestLng) && Number.isFinite(rawDestLat)
    ? { name: rawDestName, lng: rawDestLng, lat: rawDestLat }
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-orange-50 py-8">
      <div className="mx-auto max-w-[1680px] px-4 lg:px-6">
        <div className="mb-6 flex flex-col gap-2 text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.32em] text-teal-700">
            Travel AI · AMap Hybrid Navigation
          </div>
          <h1 className="text-4xl font-black text-slate-900 md:text-5xl">像高德一样使用的导航页</h1>
          <p className="text-base text-slate-600 md:text-lg">
            当前模式：{activeModeConfig.title}。先把导航入口和路线来源分离，再逐步接入真实地图能力。
          </p>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {NAVIGATION_MODES.map(mode => {
            const isActive = mode.id === activeMode
            return (
              <Link
                key={mode.id}
                href={mode.id === 'scene' && sceneId ? `?mode=scene&scene=${sceneId}` : mode.href}
                className={`rounded-3xl border px-5 py-4 text-left shadow-sm transition ${isActive ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
              >
                <div className={`text-sm font-semibold uppercase tracking-[0.24em] ${isActive ? 'text-teal-700' : 'text-slate-500'}`}>
                  {isActive ? '当前模式' : '切换入口'}
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">{mode.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{mode.description}</p>
              </Link>
            )
          })}
        </div>

        {activeMode === 'scene' ? (
          sceneId ? (
            <AmapNavigationShell sceneId={sceneId} initialDestination={initialDestination} />
          ) : activeScenes.length > 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
              <div className="mb-4 text-center">
                <h3 className="text-xl font-bold text-slate-900">选择要导航的场景</h3>
                <p className="mt-1 text-sm text-slate-500">选择一个景区或校园，进入场内导航</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeScenes.map(scene => (
                  <Link
                    key={scene.id}
                    href={`/navigation?mode=scene&scene=${scene.id}`}
                    className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-teal-300 hover:bg-teal-50 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="text-base font-bold text-slate-900 group-hover:text-teal-700">
                        {scene.name}
                      </div>
                      <span className="ml-2 shrink-0 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        {scene.scene_type === 'campus' ? '校园' : '景区'}
                      </span>
                    </div>
                    {scene.city ? (
                      <div className="mt-1.5 text-xs text-slate-500">{scene.city}</div>
                    ) : null}
                    {scene.description ? (
                      <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                        {scene.description}
                      </div>
                    ) : null}
                    <div className="mt-3 text-xs text-slate-400">
                      POI 数量：{scene.poiCount ?? '未统计'}
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-5 text-center">
                <Link
                  href="/scenes"
                  className="text-sm text-teal-600 underline underline-offset-2 hover:text-teal-800"
                >
                  去场景选择查看更多
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center shadow-lg">
              <div className="text-lg font-semibold text-amber-800">暂无可用场景</div>
              <p className="mt-2 text-sm text-amber-600">
                数据库中没有活跃的景区或校园。请先通过「场景选择」页面导入或创建场景，再进入场内导航。
              </p>
              <Link
                href="/scenes"
                className="mt-4 inline-block rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                去场景选择
              </Link>
            </div>
          )
        ) : (
          <RealWorldPoiSearch initialDestination={initialDestination} />
        )}

        {activeMode === 'scene' ? (
          <div className="mt-8 grid gap-4 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur md:grid-cols-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">起点终点导航</div>
              <div className="mt-1 text-sm text-slate-600">直接在地图上展示最短路径和步骤详情。</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">多点规划</div>
              <div className="mt-1 text-sm text-slate-600">勾选 3 个及以上 POI，生成最优访问顺序。</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">楼层切换</div>
              <div className="mt-1 text-sm text-slate-600">适合室内导航，支持楼层筛选和路线联动。</div>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur">
            <div className="text-sm font-semibold text-slate-900">真实地图导航现状与下一步</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              当前已接入真实 POI 搜索、路线规划、路线叠加、偏航检测与自动重算，以及起点来源管理（支持实时定位与手动起点）。
              下一阶段将继续完善语音逐步引导、覆盖更多回归测试用例并优化性能与错误提示体验。
            </div>
          </div>
        )}

        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-900 px-6 py-5 text-sm text-slate-200 shadow-lg">
          <div className="font-semibold text-white">接入说明</div>
          <div className="mt-2 leading-6">
            这个页面已经预留高德 JS SDK 接入位。如果 <span className="font-semibold text-emerald-300">NEXT_PUBLIC_AMAP_JS_KEY</span> 和
            <span className="font-semibold text-emerald-300"> NEXT_PUBLIC_AMAP_SECURITY_JS_CODE</span> 配好，地图会直接加载；否则会显示配置提示。
          </div>
        </div>
      </div>
    </div>
  )
}
