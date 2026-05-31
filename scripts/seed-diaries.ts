/**
 * Seed realistic travel diaries from existing scenes.
 * npx tsx scripts/seed-diaries.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const DIARY_TEMPLATES = [
  {
    title: ['{scene}一日游', '漫步{scene}', '{scene}游记', '在{scene}的{season}', '{city}之旅——{scene}篇', '探访{scene}', '遇见{scene}', '{scene}印象'],
    content: `今天终于来到了心心念念的{scene}！一进入景区，就被眼前的美景震撼了。

上午我们先去了景区的主入口，游客不算太多，天气也特别好。{scene}比照片上看到的还要壮观，{describe}。

中午在景区附近的餐厅吃了当地特色菜，味道很棒，价格也算合理。饭后休息了一会儿，继续游览。

下午去了几个比较偏的景点，人少景美，拍照特别出片。{describe2}

傍晚时分，夕阳下的{scene}格外迷人，我们一直待到景区关门才依依不舍地离开。

总的来说，{scene}非常值得一去，推荐给喜欢{style}的朋友们！已经计划下次再来了。`,
  },
  {
    title: ['{city}行的惊喜——{scene}', '不虚此行——{scene}', '{season}游{scene}', '带家人逛{scene}', '独自探访{scene}'],
    content: `这次{scene}之行完全是临时决定的，没想到成了整个{city}行程中最大的亮点。

交通方面还算方便，{transport}到的。门票提前在网上买好了，省去了排队的时间。

{scene}的历史底蕴很深厚，{detail}。一路走一路看，不知不觉就逛了两个多小时。

最惊喜的是{highlight}，这绝对是来{city}必打卡的地方。

建议：{tip}。整体体验评分五星，会推荐给朋友。`,
  },
  {
    title: ['{scene}两日深度游', '在{scene}的48小时', '周末好去处——{scene}', '{scene}攻略分享'],
    content: `趁着周末去了趟{scene}，整理一份攻略分享给大家。

【交通】
{transport}

【行程安排】
第一天：上午抵达，先逛主景区，{describe}
第二天：上午去了周边的小众景点，人少景美，强烈推荐

【美食推荐】
在附近找到几家不错的餐厅，{food}

【住宿】
住在{hotel}，性价比很高，步行到景区只要10分钟

【花销】
两天人均花费约{cost}元，{budget_comment}

【小贴士】
{tip}

总的来说是一趟非常舒服的短途旅行，推荐周末想出门放松的朋友去试试。`,
  },
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function fillTemplate(tmpl: string, vars: Record<string, string>): string {
  let result = tmpl
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
  }
  return result
}

const SEASONS = ['春天', '夏天', '秋天', '冬天', '初春', '深秋', '盛夏', '隆冬']
const STYLES = ['历史文化', '自然风光', '美食探店', '摄影打卡', '亲子出游', '户外探险', '休闲度假']
const TRANSPORTS = ['坐地铁去的，出站步行5分钟就到', '打车过去的，从市区大约30分钟', '自驾去的，停车场很大很方便', '坐公交转了一趟车，大概40多分钟', '高铁到{city}站再打车，很方便']
const HIGHLIGHTS = ['登上观景台俯瞰全景的那一刻', '遇到一只可爱的流浪猫', '在湖边看日落', '发现了一家隐藏的茶馆', '景区里的老建筑保存得太好了', '小吃街的烤串太好吃了', '偶遇一场民俗表演', '清晨人少的时候特别美']
const TIPS = ['建议早点去，避开人流高峰', '穿舒适的鞋，要走不少路', '带够水，景区里卖的比较贵', '可以提前在App上买票', '建议秋天去，景色最美', '门口有寄存行李的地方', '带相机！手机拍不出效果', '可以请个导游讲解，收获很多']
const FOODS = ['一家川菜馆的麻婆豆腐绝了', '尝试了当地特色小吃炸酱面', '路边摊的烤串太香了', '打卡了网红奶茶店', '老字号餐厅的招牌菜值得一试', '景区门口的农家菜非常地道']
const HOTELS = ['景区旁边的快捷酒店', '一家很温馨的民宿', '朋友推荐的精品酒店', '当地的一家老牌宾馆']

async function main() {
  // Get random active scenes
  const { data: scenes } = await supabase
    .from('scenes').select('id, name, city, scene_type')
    .eq('status', 'active').order('created_at', { ascending: false }).limit(100)

  // Get existing user
  const { data: profiles } = await supabase.from('profiles').select('user_id').limit(10)
  const userIds = (profiles ?? []).map(p => p.user_id)

  if (!scenes?.length) { console.log('No scenes'); return }
  if (!userIds.length) { console.log('No users'); return }

  console.log(`Creating diaries for ${Math.min(scenes.length, 60)} scenes...`)

  let count = 0
  for (const scene of scenes.slice(0, 60)) {
    const tmpl = pickRandom(DIARY_TEMPLATES)
    const season = pickRandom(SEASONS)
    const style = pickRandom(STYLES)
    const isPublished = Math.random() > 0.2 // 80% published

    const vars: Record<string, string> = {
      scene: scene.name,
      city: scene.city || '本地',
      season,
      style,
      transport: fillTemplate(pickRandom(TRANSPORTS), { city: scene.city || '本地' }),
      highlight: pickRandom(HIGHLIGHTS),
      tip: pickRandom(TIPS),
      describe: ['景色壮观令人震撼', '处处都是拍照的好地方', '古建筑保存得非常完好', '自然风光美不胜收'][randomInt(0, 3)],
      describe2: ['随手一拍都是大片', '安静得让人忘记时间', '春风吹过特别舒服', '游客渐渐少了，景区更显静谧'][randomInt(0, 3)],
      detail: ['导游讲了很多有趣的历史故事', '每一块砖瓦都透着岁月的痕迹', '了解了很多当地的文化和传说'][randomInt(0, 2)],
      food: pickRandom(FOODS),
      hotel: pickRandom(HOTELS),
      cost: String(randomInt(200, 800)),
      budget_comment: ['性价比不错', '花得很值', '比预想的便宜', '稍微有点贵但值'][randomInt(0, 3)],
    }

    const title = fillTemplate(pickRandom(tmpl.title), vars)
    const content = fillTemplate(tmpl.content, vars)

    const rawSize = new TextEncoder().encode(content).length
    const userId = pickRandom(userIds)

    const { error } = await supabase.from('diaries').insert({
      user_id: userId,
      scene_id: scene.id,
      title,
      content_raw: content,
      raw_size: rawSize,
      location_tag: scene.city || null,
      status: isPublished ? 'published' : 'draft',
      view_count: randomInt(10, 500),
      hot_score: randomInt(10, 100),
      compression_algo: 'none',
    })

    if (!error) {
      count++
      if (count % 10 === 0) console.log(`  Created ${count} diaries...`)
    }
  }

  console.log(`\nDone: ${count} diaries created`)
}

main()
