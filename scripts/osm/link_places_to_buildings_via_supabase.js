/*
Link `places` to `buildings` using Supabase REST API as a fallback when direct DB connection fails.

Approach:
 - Fetch building centroids (id, lon, lat)
 - Fetch unmatched places (id, lon, lat)
 - Compute Haversine distances in JS and assign nearest building if within threshold (meters)
 - Update `places.building_id` via Supabase API (batching)

Usage:
  node scripts/osm/link_places_to_buildings_via_supabase.js --dataset=badaling --threshold=30
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

function getArg(name, fallback) {
  const prefix = `--${name}=`
  const match = process.argv.find(arg => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : fallback
}

function toNumber(v, d) {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = v => (v * Math.PI) / 180
  const R = 6371000 // meters
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) throw new Error(`Missing env file: ${ENV_PATH}`)
  const env = parseEnvFile(fs.readFileSync(ENV_PATH, 'utf8'))
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')

  const dataset = getArg('dataset', null)
  const threshold = toNumber(getArg('threshold', '30'), 30)
  const batchSize = Math.max(1, Number(getArg('batch-size', '50')))

  const supabase = createClient(url, key)

  console.log('[link-api] Fetching building centroids...')
  // Use stored lat/lng columns when available
  const { data: buildings, error: bErr } = await supabase
    .from('buildings')
    .select('id, lat, lng')
    .limit(10000)
  if (bErr) throw new Error(`Failed to fetch buildings: ${bErr.message}`)

  const buildingPoints = (buildings || [])
    .map(b => ({ id: b.id, lon: Number(b.lng), lat: Number(b.lat) }))
    .filter(b => Number.isFinite(b.lon) && Number.isFinite(b.lat))

  console.log(`[link-api] Loaded ${buildingPoints.length} building centroids`)

  console.log('[link-api] Fetching unmatched places (building_id IS NULL)...')
  // Detect whether `building_id` column exists
  const sample = await supabase.from('places').select('*').limit(1)
  if (sample.error) throw new Error(`Failed to inspect places table: ${sample.error.message}`)
  const hasBuildingId = Array.isArray(sample.data) && sample.data.length > 0 && Object.prototype.hasOwnProperty.call(sample.data[0], 'building_id')

  const { data: placesFull, error: pFullErr } = hasBuildingId
    ? (await supabase.from('places').select('*').is('building_id', null).limit(2000))
    : (await supabase.from('places').select('*').limit(2000))
  if (pFullErr) throw new Error(`Failed to fetch places: ${pFullErr.message}`)

  const useRawField = !hasBuildingId

  function decodeWkbPoint(hex) {
    try {
      if (!hex || typeof hex !== 'string') return [null, null]
      const buf = Buffer.from(hex, 'hex')
      let offset = 0
      const little = buf.readUInt8(offset) === 1
      offset += 1
      const readUInt32 = little ? buf.readUInt32LE.bind(buf) : buf.readUInt32BE.bind(buf)
      const readDouble = little ? buf.readDoubleLE.bind(buf) : buf.readDoubleBE.bind(buf)
      const type = readUInt32(offset)
      offset += 4
      const hasSrid = (type & 0x20000000) !== 0
      if (hasSrid) {
        // skip SRID
        offset += 4
      }
      const x = readDouble(offset); offset += 8
      const y = readDouble(offset); offset += 8
      return [x, y]
    } catch (e) {
      return [null, null]
    }
  }

  const placePoints = (placesFull || []).map(p => {
    // prefer explicit lat/lng columns
    if (p.lat != null && p.lng != null) return { id: p.id, lon: Number(p.lng), lat: Number(p.lat) }
    // prefer raw.centroid if present
    try {
      if (p.raw && p.raw.centroid && Array.isArray(p.raw.centroid.coordinates)) {
        const [lng, lat] = p.raw.centroid.coordinates
        return { id: p.id, lon: Number(lng), lat: Number(lat) }
      }
    } catch (e) {}
    // parse geom WKB
    if (p.geom) {
      const [x, y] = decodeWkbPoint(String(p.geom))
      if (x != null && y != null) return { id: p.id, lon: Number(x), lat: Number(y) }
    }
    return { id: p.id, lon: null, lat: null }
  }).filter(p => Number.isFinite(p.lon) && Number.isFinite(p.lat))

  console.log(`[link-api] Found ${placePoints.length} unmatched places to consider`)

  const updates = []
  for (const place of placePoints) {
    let best = null
    let bestD = Infinity
    for (const b of buildingPoints) {
      const d = haversineDistance(place.lat, place.lon, b.lat, b.lon)
      if (d < bestD) { bestD = d; best = b }
    }
    if (best && bestD <= threshold) {
      updates.push({ id: place.id, building_id: best.id })
    }
  }

  console.log(`[link-api] Prepared ${updates.length} updates (threshold ${threshold}m)`)

  let applied = 0
  for (let i = 0; i < updates.length; i += batchSize) {
    const chunk = updates.slice(i, i + batchSize)
    // Supabase doesn't support batch UPDATE with different ids in one call easily,
    // so perform per-row updates in parallel within the chunk.
    const promises = chunk.map(async u => {
      if (useRawField) {
        // fetch existing raw and merge
        const { data: existing, error: e1 } = await supabase.from('places').select('raw').eq('id', u.id).single()
        if (e1) return { error: e1 }
        const raw = existing && existing.raw ? existing.raw : {}
        raw._linked_building_id = u.building_id
        return supabase.from('places').update({ raw }).eq('id', u.id)
      } else {
        return supabase.from('places').update({ building_id: u.building_id }).eq('id', u.id)
      }
    })
    const results = await Promise.all(promises)
    for (const r of results) {
      if (!r.error) applied += 1
    }
    console.log(`[link-api] Applied ${Math.min(i + batchSize, updates.length)}/${updates.length}`)
  }

  console.log(`[link-api] Done. Applied ${applied}/${updates.length} updates.`)
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})
