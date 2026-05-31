/**
 * Enrich scenes with center coordinates and cover images from AMap POI search.
 * Usage: npx tsx scripts/enrich-scene-images.ts
 */
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import { config } from 'dotenv'
config({ path: '.env.local' })

const AMAP_KEY = process.env.AMAP_SERVICE_KEY || process.env.AMAP_API_KEY || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!AMAP_KEY) { console.error('Missing AMap key'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  // Get all active scenes missing coordinates
  const { data: scenes } = await supabase
    .from('scenes')
    .select('id, name, city')
    .eq('status', 'active')
    .is('center_lat', null)

  if (!scenes?.length) {
    console.log('All scenes already have coordinates.')
    return
  }

  console.log(`Found ${scenes.length} scenes without coordinates. Enriching...`)

  for (const scene of scenes) {
    const query = scene.city ? `${scene.city} ${scene.name}` : scene.name
    console.log(`  Searching: ${query}`)

    try {
      const res = await axios.get('https://restapi.amap.com/v3/place/text', {
        params: { key: AMAP_KEY, keywords: query, offset: 1, output: 'json' },
        timeout: 5000,
      })

      const poi = res.data?.pois?.[0]
      if (!poi?.location) {
        console.log(`    -> No result found`)
        continue
      }

      const [lng, lat] = poi.location.split(',').map(Number)
      const rawPhotoUrl: string | null = poi.photos?.[0]?.url || null
      const photoUrl = rawPhotoUrl ? rawPhotoUrl.replace('http://', 'https://') : null

      await supabase
        .from('scenes')
        .update({
          center_lat: lat,
          center_lng: lng,
          cover_image_url: photoUrl,
        })
        .eq('id', scene.id)

      console.log(`    -> Updated: (${lng}, ${lat}) photo: ${photoUrl ? 'yes' : 'no'}`)

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200))
    } catch (err: any) {
      console.log(`    -> Error: ${err.message}`)
    }
  }

  console.log('Done.')
}

main()
