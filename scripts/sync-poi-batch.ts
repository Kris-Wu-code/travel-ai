import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import { config } from 'dotenv'
config({ path: '.env.local' })

const AMAP_KEY = process.env.AMAP_SERVICE_KEY || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  const { data: scenes } = await supabase
    .from('scenes').select('id, name, city, center_lat, center_lng')
    .eq('status', 'active').not('center_lat', 'is', null).limit(300)

  if (!scenes?.length) { console.log('No scenes'); return }

  const { data: ep } = await supabase.from('poi_items').select('scene_id')
  const skipIds = new Set((ep ?? []).map(p => p.scene_id).filter(Boolean))
  const toSync = scenes.filter(s => !skipIds.has(s.id))
  console.log(`${toSync.length} to sync (${scenes.length - toSync.length} done)`)

  let total = 0
  for (let i = 0; i < toSync.length; i++) {
    const s = toSync[i]
    try {
      const res = await axios.get('https://restapi.amap.com/v3/place/around', {
        params: {
          key: AMAP_KEY, location: `${s.center_lng},${s.center_lat}`,
          keywords: '餐厅|美食|小吃|景点|公园|博物馆|酒店|超市|咖啡',
          types: '050000|060000|080000|100000|110000',
          radius: 8000, offset: 25, page: 1, output: 'json',
        }, timeout: 8000,
      })

      const pois = (res.data?.pois || []).slice(0, 25)
      const rows: any[] = []
      for (const p of pois) {
        if (!p.location) continue
        const [lng, lat] = p.location.split(',').map(Number)
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
        rows.push({
          scene_id: s.id, name: (p.name || '').slice(0, 120),
          category: 'attraction', source: 'amap', source_id: String(p.id),
          city: s.city, address: p.address || '',
          latitude: lat, longitude: lng,
          price_level: 2,
          avg_rating: Number(p.biz_ext?.rating) || null,
          tags: (p.type || '').split(';').slice(0, 5),
          status: 'approved',
        })
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('poi_items').insert(rows)
        if (!error) { total += rows.length; console.log(`[${i + 1}/${toSync.length}] ${s.name}: +${rows.length}`) }
        else if (i < 3) console.log(`  DB error: ${error.message}`)
      }
      if (i < 3 && rows.length === 0) console.log(`  No POIs from AMap for ${s.name}`)
    } catch (err: any) {
      if (i < 3) console.log(`  Fetch error for ${s.name}: ${err?.message}`)
    }
    await new Promise(r => setTimeout(r, 150))
  }
  console.log(`\nDone: ${total} total POIs`)
}
main()
