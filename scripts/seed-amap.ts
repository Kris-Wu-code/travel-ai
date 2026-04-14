import axios from 'axios'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config({ path: '.env.local' })

const AMAP_KEY = process.env.AMAP_API_KEY!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── 场景配置 ────────────────────────────────────────────────────────────────
// 每个场景定义要搜索的关键词和分类
const SCENES = [
  {
    id:   'a0000000-0000-0000-0000-000000000001',
    name: '故宫景区',
    type: 'scenic_spot' as const,
    city: '北京',
    center: { lat: 39.9163, lng: 116.3972 },
    transports: ['walk', 'ev'],
    // 高德 POI 分类代码：https://lbs.amap.com/api/webservice/guide/api/search
    searches: [
      { keywords: '故宫',     types: '110000', label: 'attraction' },  // 景点
      { keywords: '故宫附近餐厅', types: '050000', label: 'restaurant' }, // 餐厅
      { keywords: '故宫咖啡',  types: '050000', label: 'restaurant'  },
      { keywords: '故宫商店',  types: '060000', label: 'other'       }, // 购物
      { keywords: '天安门广场', types: '110000', label: 'attraction'  },
      { keywords: '景山公园',  types: '110000', label: 'attraction'  },
      { keywords: '北海公园',  types: '110000', label: 'attraction'  },
    ],
  },
  {
    id:   'a0000000-0000-0000-0000-000000000002',
    name: '北京邮电大学',
    type: 'campus' as const,
    city: '北京',
    center: { lat: 39.9622, lng: 116.3546 },
    transports: ['walk', 'bike'],
    searches: [
      { keywords: '北京邮电大学食堂',   types: '050000', label: 'restaurant'  },
      { keywords: '北京邮电大学超市',   types: '060900', label: 'supermarket' },
      { keywords: '北京邮电大学图书馆', types: '140000', label: 'library'     },
      { keywords: '北京邮电大学',       types: '141200', label: 'attraction'  },
      { keywords: '北邮附近餐厅',       types: '050000', label: 'restaurant'  },
      { keywords: '北邮附近咖啡',       types: '050000', label: 'restaurant'  },
    ],
  },
]

// ─── 高德 POI 分类 → 我们数据库分类 的映射 ───────────────────────────────────
function mapCategory(amapType: string, label: string): string {
  if (label === 'attraction')  return 'attraction'
  if (label === 'library')     return 'library'
  if (label === 'supermarket') return 'supermarket'
  if (label === 'restaurant')  return 'restaurant'
  if (amapType?.startsWith('05')) return 'restaurant'
  if (amapType?.startsWith('06')) return 'supermarket'
  if (amapType?.startsWith('11')) return 'attraction'
  if (amapType?.startsWith('14')) return 'library'
  return 'other'
}

// ─── 调用高德 POI 搜索接口 ────────────────────────────────────────────────────
async function searchAmap(keywords: string, types: string, city: string, page = 1) {
  const url = 'https://restapi.amap.com/v3/place/text'
  try {
    const res = await axios.get(url, {
      params: {
        key:      AMAP_KEY,
        keywords,
        types,
        city,
        offset:   25,   // 每次返回最多25条
        page,
        output:   'json',
        extensions: 'base',
      },
      timeout: 8000,
    })

    if (res.data.status === '1' && res.data.pois) {
      return res.data.pois
    }
    console.log(`  [跳过] ${keywords} 无结果或接口异常:`, res.data.info)
    return []
  } catch (err: any) {
    console.log(`  [错误] ${keywords}:`, err.message)
    return []
  }
}

// ─── 把高德 POI 数据转换成我们的数据库格式 ───────────────────────────────────
function transformPoi(poi: any, scene: typeof SCENES[0], label: string) {
  const [lng, lat] = (poi.location || '').split(',').map(Number)
  if (!lng || !lat) return null

  return {
    name:        poi.name?.slice(0, 200) || '未知',
    category:    mapCategory(poi.type, label),
    scene_type:  scene.type,
    scene_id:    scene.id,
    city:        scene.city,
    address:     poi.address?.slice(0, 500) || '',
    latitude:    lat,
    longitude:   lng,
    price_level: 2,
    tags:        poi.type ? [poi.typecode] : [],
    source:      'amap' as const,
    source_id:   poi.id,
    status:      'approved' as const,
  }
}

// ─── 把餐厅类 POI 同步到 food_items 表 ───────────────────────────────────────
async function insertFoodItem(poi: any, scene: typeof SCENES[0]) {
  const [lng, lat] = (poi.location || '').split(',').map(Number)
  if (!lng || !lat) return

  // 简单判断菜系
  const name: string = poi.name || ''
  let cuisine = '其他'
  if (name.includes('川') || name.includes('麻辣') || name.includes('火锅')) cuisine = '川菜'
  else if (name.includes('粤') || name.includes('广东')) cuisine = '粤菜'
  else if (name.includes('面') || name.includes('兰州') || name.includes('拉面')) cuisine = '清真'
  else if (name.includes('日') || name.includes('寿司') || name.includes('拉面')) cuisine = '日料'
  else if (name.includes('咖啡') || name.includes('coffee')) cuisine = '咖啡'
  else if (name.includes('甜') || name.includes('奶茶') || name.includes('冰')) cuisine = '甜品'
  else if (name.includes('食堂') || name.includes('快餐') || name.includes('米饭')) cuisine = '快餐'

  const { error } = await supabase
    .from('food_items')
    .upsert({
      name:        name.slice(0, 200),
      scene_id:    scene.id,
      cuisine_type: cuisine,
      canteen_name: name.slice(0, 100),
      price_range: '10-50',
      avg_rating:  3.5 + Math.random() * 1.5,  // 3.5~5.0 随机评分
      hot_score:   Math.floor(Math.random() * 800) + 100,
      status:      'approved',
    }, { onConflict: 'name,scene_id' })  // 同名同场景不重复插入

  if (error && !error.message.includes('duplicate')) {
    console.log('  [food_items 写入失败]', name, error.message)
  }
}

// ─── 主函数 ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== 个性化旅游系统 — 高德 POI 数据导入 ===\n')

  // 先把两个场景写入 scenes 表
  console.log('① 写入场景数据...')
  for (const scene of SCENES) {
    const { error } = await supabase
      .from('scenes')
      .upsert({
        id:                   scene.id,
        name:                 scene.name,
        scene_type:           scene.type,
        city:                 scene.city,
        center_lat:           scene.center.lat,
        center_lng:           scene.center.lng,
        available_transports: scene.transports,
        status:               'active',
      }, { onConflict: 'id' })

    if (error) {
      console.log(`  [场景写入失败] ${scene.name}:`, error.message)
    } else {
      console.log(`  ✓ ${scene.name}`)
    }
  }

  console.log('\n② 搜索并导入 POI 数据...')

  let totalInserted = 0

  for (const scene of SCENES) {
    console.log(`\n  【${scene.name}】`)

    for (const search of scene.searches) {
      console.log(`  搜索: ${search.keywords}`)

      // 搜索第1页和第2页，最多拿50条
      for (let page = 1; page <= 2; page++) {
        const pois = await searchAmap(search.keywords, search.types, scene.city, page)
        if (pois.length === 0) break

        const records = pois
          .map((poi: any) => transformPoi(poi, scene, search.label))
          .filter(Boolean)

        if (records.length === 0) continue

        // 批量写入 poi_items
        const { error, data } = await supabase
          .from('poi_items')
          .upsert(records, { onConflict: 'source,source_id', ignoreDuplicates: true })

        if (error) {
          console.log(`    [写入失败]:`, error.message)
        } else {
          console.log(`    ✓ 写入 ${records.length} 条 POI`)
          totalInserted += records.length

          // 餐厅类同步到 food_items
          const restaurants = pois.filter((p: any) =>
            p.type?.startsWith('05') || search.label === 'restaurant'
          )
          for (const poi of restaurants) {
            await insertFoodItem(poi, scene)
          }
        }

        // 避免请求太快被限流
        await new Promise(r => setTimeout(r, 300))
      }
    }
  }

  console.log(`\n=== 导入完成！共写入约 ${totalInserted} 条 POI ===`)
  console.log('请前往 Supabase Table Editor 查看 poi_items 和 food_items 表\n')
}

main().catch(console.error)