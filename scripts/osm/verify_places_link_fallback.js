/*
Verify the fallback building link stored in places.raw._linked_building_id.

Usage:
  node scripts/osm/verify_places_link_fallback.js
*/

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const ROOT = path.join(__dirname, '..', '..')
const ENV_PATH = path.join(ROOT, '.env.local')

function parseEnvFile(text) {
  const env = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    env[key] = value
  }
  return env
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) throw new Error(`Missing env file: ${ENV_PATH}`)

  const env = parseEnvFile(fs.readFileSync(ENV_PATH, 'utf8'))
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')

  const supabase = createClient(url, key)
  const { data, error } = await supabase.from('places').select('id, name, source_id, raw').limit(500)
  if (error) throw error

  const items = Array.isArray(data) ? data : []
  const linked = items.filter(item => item.raw && item.raw._linked_building_id)

  console.log(JSON.stringify({
    totalSampled: items.length,
    linkedCount: linked.length,
    linkedSample: linked.slice(0, 10).map(item => ({
      id: item.id,
      name: item.name,
      source_id: item.source_id,
      linked_building_id: item.raw._linked_building_id,
    })),
  }, null, 2))
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})
