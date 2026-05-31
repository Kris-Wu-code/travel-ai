/**
 * Import more scenic spots from AMap across additional Chinese cities.
 * Usage: npx tsx scripts/import-more-scenes.ts
 */
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import { config } from 'dotenv'
config({ path: '.env.local' })

const AMAP_KEY = process.env.AMAP_SERVICE_KEY || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!AMAP_KEY) { console.error('Missing AMap key'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CITIES = [
  '成都', '重庆', '武汉', '长沙', '青岛', '大连',
  '三亚', '昆明', '桂林', '张家界', '拉萨', '哈尔滨',
  '贵阳', '郑州', '天津', '黄山', '乌鲁木齐', '呼伦贝尔',
  '敦煌', '洛阳', '开封', '太原', '南昌', '南宁',
  '福州', '温州', '宁波', '珠海', '佛山', '合肥',
  '济南', '兰州', '西宁', '银川', '海口', '秦皇岛',
  '大理', '香格里拉', '稻城', '喀纳斯',
]

async function main() {
  for (const city of CITIES) {
    console.log(`\nSearching: ${city}...`)

    try {
      const res = await axios.get('https://restapi.amap.com/v3/place/text', {
        params: {
          key: AMAP_KEY,
          keywords: '风景名胜|公园|古镇|寺庙|博物馆',
          city,
          types: '110000|110100|110200|140000',
          offset: 10,
          page: 1,
          extensions: 'all',
          output: 'json',
        },
        timeout: 8000,
      })

      const pois = res.data?.pois || []
      let imported = 0

      for (const poi of pois) {
        if (!poi.location) continue
        const [lng, lat] = poi.location.split(',').map(Number)
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue

        const name = (poi.name || '').slice(0, 120)
        const photoUrl = (poi.photos?.[0]?.url || '').replace('http://', 'https://')

        // Skip if already exists
        const { data: existing } = await supabase.from('scenes').select('id').eq('name', name).eq('city', city).limit(1)
        if (existing?.length) continue

        const { error } = await supabase.from('scenes').insert({
          name,
          scene_type: 'scenic_spot',
          city,
          description: `${city}热门旅游景点：${name}`,
          center_lat: lat,
          center_lng: lng,
          cover_image_url: photoUrl || null,
          status: 'active',
        })

        if (!error) imported++
        await new Promise(r => setTimeout(r, 50))
      }

      console.log(`  Imported ${imported} scenes for ${city}`)
      await new Promise(r => setTimeout(r, 300))
    } catch (err: any) {
      console.log(`  Error: ${err.message}`)
    }
  }

  console.log('\nDone.')
}

main()
