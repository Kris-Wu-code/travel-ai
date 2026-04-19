import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

type SeedScene = {
  name: string
  city: string
}

const SCENES: SeedScene[] = [
  { name: '故宫博物院', city: '北京' },
  { name: '八达岭长城', city: '北京' },
  { name: '颐和园', city: '北京' },
  { name: '天坛公园', city: '北京' },
  { name: '圆明园遗址公园', city: '北京' },
  { name: '什刹海', city: '北京' },
  { name: '恭王府', city: '北京' },
  { name: '北海公园', city: '北京' },
  { name: '国家博物馆', city: '北京' },
  { name: '南锣鼓巷', city: '北京' },

  { name: '外滩', city: '上海' },
  { name: '东方明珠', city: '上海' },
  { name: '豫园', city: '上海' },
  { name: '上海迪士尼度假区', city: '上海' },
  { name: '上海博物馆', city: '上海' },
  { name: '南京路步行街', city: '上海' },
  { name: '田子坊', city: '上海' },
  { name: '上海科技馆', city: '上海' },
  { name: '朱家角古镇', city: '上海' },
  { name: '静安寺', city: '上海' },

  { name: '广州塔', city: '广州' },
  { name: '白云山', city: '广州' },
  { name: '陈家祠', city: '广州' },
  { name: '沙面', city: '广州' },
  { name: '越秀公园', city: '广州' },
  { name: '长隆旅游度假区', city: '广州' },
  { name: '永庆坊', city: '广州' },
  { name: '北京路步行街', city: '广州' },
  { name: '广东省博物馆', city: '广州' },
  { name: '上下九步行街', city: '广州' },

  { name: '深圳湾公园', city: '深圳' },
  { name: '世界之窗', city: '深圳' },
  { name: '锦绣中华民俗村', city: '深圳' },
  { name: '东部华侨城', city: '深圳' },
  { name: '莲花山公园', city: '深圳' },
  { name: '大梅沙海滨公园', city: '深圳' },
  { name: '仙湖植物园', city: '深圳' },
  { name: '欢乐海岸', city: '深圳' },
  { name: '梧桐山', city: '深圳' },
  { name: '深圳博物馆', city: '深圳' },

  { name: '西湖风景名胜区', city: '杭州' },
  { name: '灵隐寺', city: '杭州' },
  { name: '千岛湖', city: '杭州' },
  { name: '宋城', city: '杭州' },
  { name: '西溪国家湿地公园', city: '杭州' },
  { name: '雷峰塔', city: '杭州' },
  { name: '河坊街', city: '杭州' },
  { name: '良渚古城遗址公园', city: '杭州' },
  { name: '湘湖', city: '杭州' },
  { name: '杭州植物园', city: '杭州' },

  { name: '夫子庙秦淮风光带', city: '南京' },
  { name: '中山陵', city: '南京' },
  { name: '明孝陵', city: '南京' },
  { name: '总统府', city: '南京' },
  { name: '玄武湖', city: '南京' },
  { name: '南京博物院', city: '南京' },
  { name: '老门东', city: '南京' },
  { name: '鸡鸣寺', city: '南京' },
  { name: '牛首山', city: '南京' },
  { name: '侵华日军南京大屠杀遇难同胞纪念馆', city: '南京' },

  { name: '拙政园', city: '苏州' },
  { name: '留园', city: '苏州' },
  { name: '周庄古镇', city: '苏州' },
  { name: '同里古镇', city: '苏州' },
  { name: '苏州博物馆', city: '苏州' },
  { name: '平江路', city: '苏州' },
  { name: '虎丘山风景名胜区', city: '苏州' },
  { name: '寒山寺', city: '苏州' },
  { name: '金鸡湖景区', city: '苏州' },
  { name: '网师园', city: '苏州' },

  { name: '鼓浪屿', city: '厦门' },
  { name: '南普陀寺', city: '厦门' },
  { name: '厦门大学', city: '厦门' },
  { name: '环岛路', city: '厦门' },
  { name: '曾厝垵', city: '厦门' },
  { name: '集美学村', city: '厦门' },
  { name: '胡里山炮台', city: '厦门' },
  { name: '园林植物园', city: '厦门' },
  { name: '沙坡尾', city: '厦门' },
  { name: '白城沙滩', city: '厦门' },

  { name: '兵马俑', city: '西安' },
  { name: '大雁塔', city: '西安' },
  { name: '西安城墙', city: '西安' },
  { name: '华清宫', city: '西安' },
  { name: '大唐芙蓉园', city: '西安' },
  { name: '钟楼', city: '西安' },
  { name: '回民街', city: '西安' },
  { name: '陕西历史博物馆', city: '西安' },
  { name: '小雁塔', city: '西安' },
  { name: '华山', city: '西安' },

  { name: '丽江古城', city: '丽江' },
  { name: '玉龙雪山', city: '丽江' },
  { name: '束河古镇', city: '丽江' },
  { name: '泸沽湖', city: '丽江' },
  { name: '拉市海', city: '丽江' },
  { name: '黑龙潭公园', city: '丽江' },
  { name: '木府', city: '丽江' },
  { name: '蓝月谷', city: '丽江' },
  { name: '白沙古镇', city: '丽江' },
  { name: '虎跳峡', city: '丽江' },
]

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  console.log(`准备导入 ${SCENES.length} 个景点...`)

  const { data: existingRows, error: existingError } = await supabase
    .from('scenes')
    .select('name, city')
    .eq('scene_type', 'scenic_spot')

  if (existingError) {
    throw new Error(`读取已有 scenes 失败: ${existingError.message}`)
  }

  const existingSet = new Set(
    (existingRows ?? []).map((row: { name: string | null; city: string | null }) =>
      `${String(row.name || '').trim()}|${String(row.city || '').trim()}`,
    ),
  )

  const now = new Date().toISOString()
  const inserts = SCENES
    .filter(scene => !existingSet.has(`${scene.name}|${scene.city}`))
    .map(scene => ({
      name: scene.name,
      city: scene.city,
      scene_type: 'scenic_spot',
      status: 'active',
      description: `国内热门旅游景点：${scene.name}`,
      available_transports: ['步行', '公交', '地铁', '出租车'],
      created_at: now,
      updated_at: now,
    }))

  if (inserts.length === 0) {
    console.log('没有需要新增的景点，已全部存在。')
    return
  }

  const { error: insertError } = await supabase
    .from('scenes')
    .insert(inserts)

  if (insertError) {
    throw new Error(`写入 scenes 失败: ${insertError.message}`)
  }

  console.log(`导入完成：新增 ${inserts.length} 个景点（目标总数 ${SCENES.length}）。`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
