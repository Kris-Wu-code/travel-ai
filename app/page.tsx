import Link from 'next/link'
import { createAdminClient } from '@/app/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/app/lib/database.types'
import GlobalSearch from './components/global-search'
import HeroCarousel from './components/hero-carousel'
import HotKeywords from './components/hot-keywords'

type SceneCard = {
  id: string
  name: string
  scene_type: string
  city: string | null
  description: string | null
  cover_image_url: string | null
  center_lat: number | null
  center_lng: number | null
  poi_count: number | null
  poiCount: number
}

const HOT_CITIES = new Set(['北京','上海','杭州','成都','西安','南京','广州','深圳','厦门','丽江','重庆','苏州'])
function recScore(s: any): number {
  let score = (s.poiCount || 0) * 3
  if (s.city && HOT_CITIES.has(s.city)) score += 10
  if (s.cover_image_url) score += 5
  return score
}

async function getHotScenes(): Promise<SceneCard[]> {
  try {
    const supabase = createAdminClient()

    const { data: sceneData } = await supabase
      .from('scenes')
      .select('id, name, scene_type, city, description, cover_image_url, center_lat, center_lng, poi_count')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    const scenes: SceneCard[] = (sceneData ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      scene_type: s.scene_type,
      city: s.city,
      description: s.description,
      cover_image_url: s.cover_image_url,
      center_lat: s.center_lat,
      center_lng: s.center_lng,
      poiCount: s.poi_count ?? 0,
    }))

    scenes.sort((a, b) => recScore(b) - recScore(a) || 0)
    return scenes.slice(0, 20)
  } catch {
    return []
  }
}

function getSceneImage(scene: SceneCard, fallbackIndex: number): string {
  if (scene.cover_image_url) return scene.cover_image_url

  // AMap static map as thumbnail when coordinates exist
  const amapKey = process.env.AMAP_SERVICE_KEY || process.env.AMAP_API_KEY || ''
  if (scene.center_lat != null && scene.center_lng != null && amapKey) {
    return `https://restapi.amap.com/v3/staticmap?location=${scene.center_lng},${scene.center_lat}&zoom=13&size=440*260&markers=mid,,A:${scene.center_lng},${scene.center_lat}&key=${amapKey}`
  }

  const fallbacks = [
    'https://images.unsplash.com/photo-1549893074-35c4f79b1c65?auto=format&fit=crop&w=440&h=260&q=80',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=440&h=260&q=80',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=440&h=260&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=440&h=260&q=80',
  ]
  return fallbacks[fallbackIndex % fallbacks.length]
}

const FALLBACK_SLIDES = [
  {
    id: 'fallback-1', name: '西湖晨雾 · 杭州',
    description: '清晨游船与苏堤慢行的经典组合',
    image: 'https://images.unsplash.com/photo-1549893074-35c4f79b1c65?auto=format&fit=crop&w=440&h=260&q=80',
  },
  {
    id: 'fallback-2', name: '鼓浪屿黄昏 · 厦门',
    description: '老洋房、海风和夜色里的街角音乐',
    image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=440&h=260&q=80',
  },
  {
    id: 'fallback-3', name: '雪山湖光 · 丽江',
    description: '高原日照下的松弛度假节奏',
    image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=440&h=260&q=80',
  },
  {
    id: 'fallback-4', name: '城市夜游 · 重庆',
    description: '立体交通与山城夜景的高密体验',
    image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=440&h=260&q=80',
  },
]

export default async function Home() {
  const navItems = [
    { label: '发现景区', href: '/scenes', desc: '按主题和城市筛选' },
    { label: '路线规划', href: '/itinerary', desc: '一键生成行程草案' },
    { label: '美食地图', href: '/foods', desc: '边走边吃不踩坑' },
    { label: '游记广场', href: '/diary', desc: '看真实体验和攻略' },
    { label: '探索推荐', href: '/explore', desc: '根据偏好找灵感' },
  ]

  const hotScenes = await getHotScenes()

  // Get current user (server-side)
  let currentUser: { id: string; email?: string; name: string; avatar: string } | null = null
  try {
    const cookieStore = await cookies()
    const supabaseServer = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    )
    const { data: { user } } = await supabaseServer.auth.getUser()
    if (user) {
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('display_name, preferences')
        .eq('user_id', user.id)
        .maybeSingle()

      currentUser = {
        id: user.id,
        email: user.email,
        name: (profile as any)?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '旅行者',
        avatar: (profile as any)?.preferences?.profile_avatar_url || user.user_metadata?.avatar_url || '',
      }
    }
  } catch {
    // Not logged in — show register/login
  }

  const slides = hotScenes.length > 0
    ? hotScenes.map((s, i) => ({
        id: s.id,
        title: s.city ? `${s.name} · ${s.city}` : s.name,
        subtitle: s.description || `POI 数量：${s.poiCount}`,
        href: `/scenes/${s.id}`,
        image: getSceneImage(s, i),
      }))
    : FALLBACK_SLIDES.map(s => ({
        id: s.id,
        title: s.name,
        subtitle: s.description,
        href: '/scenes',
        image: s.image,
      }))

  const navigationEntrances = [
    {
      title: '场内导航',
      href: '/navigation?mode=scene',
      desc: '适合校园、景区内部、楼层与馆区之间的精细路径导航。',
      accent: 'from-teal-500 to-emerald-500',
      badge: '内部路径',
    },
    {
      title: '真实地图导航',
      href: '/navigation?mode=real-world',
      desc: '适合景区入口、校园校门、停车场和周边道路的真实路线。',
      accent: 'from-orange-500 to-amber-500',
      badge: '高德路线',
    },
  ]

  return (
    <div className="home-shell">
      <aside className="home-sidebar">
        <div className="brand-block">
          <div className="brand-badge">TRAVEL AI</div>
          <h1>你的下一站，从这里开始</h1>
          <p>先选目的地，再按交通、预算和节奏快速收敛方案。</p>
        </div>

        <nav className="menu-list" aria-label="主页功能导航">
          {navItems.map(item => (
            <Link href={item.href} key={item.label} className="menu-item">
              <span>{item.label}</span>
              <small>{item.desc}</small>
            </Link>
          ))}
        </nav>

        <div className="auth-actions">
          {currentUser ? (
            <Link href="/profile" className="user-chip">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt="" className="user-chip-avatar" />
              ) : (
                <span className="user-chip-avatar-fallback">
                  {currentUser.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="user-chip-name">{currentUser.name}</span>
            </Link>
          ) : (
            <>
              <Link href="/auth/register" className="btn btn-primary">
                立即注册
              </Link>
              <Link href="/auth/login" className="btn btn-ghost">
                登录账号
              </Link>
            </>
          )}
        </div>
      </aside>

      <main className="home-main">
        <HotKeywords />

        <section className="search-panel" aria-label="目的地搜索区">
          <div className="search-meta">
            <strong>智能搜索</strong>
            <span>输入城市、景区、主题词，例如：海边、亲子、古镇、徒步</span>
          </div>
          <GlobalSearch className="search-row" buttonLabel="开始探索" />
        </section>

        <section className="navigation-panel" aria-label="导航入口">
          <div className="navigation-panel__header">
            <div>
              <strong>导航中心</strong>
              <span>先选导航模式，再进入对应能力页面</span>
            </div>
            <Link href="/navigation" className="navigation-panel__link">
              打开导航页
            </Link>
          </div>

          <div className="navigation-panel__grid">
            {navigationEntrances.map(item => (
              <Link key={item.title} href={item.href} className="navigation-entry">
                <div className={`navigation-entry__badge bg-gradient-to-r ${item.accent}`}>
                  {item.badge}
                </div>
                <div className="navigation-entry__title">{item.title}</div>
                <p className="navigation-entry__desc">{item.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <HeroCarousel
          slides={slides}
          banner={hotScenes.length > 0 ? '🔥 热门景区 · 按推荐度排序' : undefined}
        />

        <section className="quick-grid" aria-label="快捷入口">
          <Link href="/scenes" className="quick-card">
            <h3>热门景区榜</h3>
            <p>按 POI 丰富度与近期热度排序</p>
          </Link>
          <Link href="/navigation" className="quick-card">
            <h3>导航与到达</h3>
            <p>查看路线、车程和换乘建议</p>
          </Link>
          <Link href="/foods" className="quick-card">
            <h3>周边美食</h3>
            <p>景区周边可达餐厅和评价聚合</p>
          </Link>
        </section>
      </main>
    </div>
  )
}
