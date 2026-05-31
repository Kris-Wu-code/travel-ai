/**
 * Sync POI data from AMap for all active scenes.
 * Searches for nearby restaurants, shops, and attractions around each scene.
 * Usage: npx tsx scripts/sync-poi-all-scenes.ts
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

const SEARCH_CATEGORIES = [
  { keywords: '餐厅|美食|小吃|咖啡', types: '050000', label: '餐饮' },
  { keywords: '便利店|超市|商场', types: '060000', label: '购物' },
]

async function main() {
  // Get all active scenes with coordinates
  const { data: scenes } = await supabase
    .from('scenes')
    .select('id, name, city, center_lat, center_lng')
    .eq('status', 'active')
    .not('center_lat', 'is', null)

  if (!scenes?.length) { console.log('No scenes with coordinates.'); return }

  console.log(`Syncing POIs for ${scenes.length} scenes...\n`)

  let totalPoiWritten = 0
  let totalFoodWritten = 0

  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si]
    if (!scene.center_lng || !scene.center_lat) continue

    const progress = `[${si + 1}/${scenes.length}]`

    // Check existing POI count for this scene
    const { count: existingCount } = await supabase
      .from('poi_items')
      .select('id', { count: 'exact', head: true })
      .eq('scene_id', scene.id)

    if ((existingCount ?? 0) >= 20) {
      if (si % 50 === 0) console.log(`${progress} ${scene.name}: already has ${existingCount} POIs, skipped`)
      continue
    }

    let scenePoiCount = 0

    for (const cat of SEARCH_CATEGORIES) {
      try {
        const res = await axios.get('https://restapi.amap.com/v3/place/around', {
          params: {
            key: AMAP_KEY,
            location: `${scene.center_lng},${scene.center_lat}`,
            keywords: cat.keywords,
            types: cat.types,
            radius: 3000,
            offset: 15,
            page: 1,
            extensions: 'all',
            output: 'json',
          },
          timeout: 8000,
        })

        const pois = res.data?.pois || []

        for (const poi of pois) {
          if (!poi.location) continue
          const [lng, lat] = poi.location.split(',').map(Number)
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue

          const sourceId = String(poi.id || `${poi.name}-${lng}-${lat}`)

          // Check if already exists for this scene
          const { data: existing } = await supabase
            .from('poi_items')
            .select('id')
            .eq('scene_id', scene.id)
            .eq('source_id', sourceId)
            .limit(1)

          if (existing?.length) continue

          const { error: insertErr } = await supabase.from('poi_items').insert({
            scene_id: scene.id,
            name: (poi.name || '未知').slice(0, 120),
            category: cat.label,
            source: 'amap',
            source_id: sourceId,
            city: scene.city,
            address: poi.address || '',
            latitude: lat,
            longitude: lng,
            avg_rating: Number(poi.biz_ext?.rating) || null,
            price_level: Number(poi.biz_ext?.cost) || null,
            tags: (poi.type || '').split(';').slice(0, 5),
            status: 'approved',
          })

          if (!insertErr) {
            scenePoiCount++
            totalPoiWritten++
          }
        }

        await new Promise(r => setTimeout(r, 100))
      } catch (err: any) {
        // skip individual failures
      }
    }

    if (scenePoiCount > 0) {
      console.log(`${progress} ${scene.name} (${scene.city}): +${scenePoiCount} POIs`)
    } else if (si % 20 === 0) {
      console.log(`${progress} ${scene.name} (${scene.city}): no new POIs`)
    }

    // Rate limit: 300ms between scenes
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\nDone. Total POIs written: ${totalPoiWritten}`)
}

main()
