/*
Import BUPT Shahe normalized data into Supabase using service-role key.

Usage examples:
  node scripts/import-bupt-shahe.js --limit=50 --tables=buildings,facilities --scene-id=a0000000-0000-0000-0000-000000000002
  node scripts/import-bupt-shahe.js --limit=0 --tables=all --scene-id=a0000000-0000-0000-0000-000000000002
*/

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const DATA_PATH = path.join(ROOT, 'scripts', 'data', 'bupt_shahe.normalized.json')
const DEFAULT_SCENE_ID = 'a0000000-0000-0000-0000-000000000002'

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
  if (!match) return fallback
  return match.slice(prefix.length)
}

function chunk(array, size) {
  const out = []
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size))
  }
  return out
}

function pickFirstCoordinate(geometry) {
  if (!geometry || !geometry.type || !Array.isArray(geometry.coordinates)) return null
  const c = geometry.coordinates
  if (geometry.type === 'Point') return c
  if (geometry.type === 'LineString') return c[0] || null
  if (geometry.type === 'Polygon') return c[0] && c[0][0] ? c[0][0] : null
  if (geometry.type === 'MultiPolygon') return c[0] && c[0][0] && c[0][0][0] ? c[0][0][0] : null
  if (geometry.type === 'MultiLineString') return c[0] && c[0][0] ? c[0][0] : null
  return null
}

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function osmIdToBigintString(value) {
  if (value === null || value === undefined) return null
  const m = String(value).match(/(\d+)/)
  return m ? m[1] : null
}

function quoteWktValue(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0'
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : '0'
}

function ringToWkt(ring) {
  return ring.map(pt => `${quoteWktValue(pt[0])} ${quoteWktValue(pt[1])}`).join(', ')
}

function geometryToWkt(geometry) {
  if (!geometry || !geometry.type || !Array.isArray(geometry.coordinates)) return null
  const c = geometry.coordinates

  if (geometry.type === 'Point') {
    return `POINT(${quoteWktValue(c[0])} ${quoteWktValue(c[1])})`
  }

  if (geometry.type === 'LineString') {
    return `LINESTRING(${ringToWkt(c)})`
  }

  if (geometry.type === 'Polygon') {
    const rings = c.map(ring => `(${ringToWkt(ring)})`).join(', ')
    return `POLYGON(${rings})`
  }

  if (geometry.type === 'MultiLineString') {
    const lines = c.map(line => `(${ringToWkt(line)})`).join(', ')
    return `MULTILINESTRING(${lines})`
  }

  if (geometry.type === 'MultiPolygon') {
    const polygons = c
      .map(poly => {
        const rings = poly.map(ring => `(${ringToWkt(ring)})`).join(', ')
        return `(${rings})`
      })
      .join(', ')
    return `MULTIPOLYGON(${polygons})`
  }

  return null
}

function mapBuilding(row, sceneId) {
  const center = row.centroid && row.centroid.type === 'Point'
    ? row.centroid.coordinates
    : pickFirstCoordinate(row.geom)

  const lng = center ? toFiniteNumber(center[0]) : null
  const lat = center ? toFiniteNumber(center[1]) : null

  const levelsNumber = toFiniteNumber(row.levels)
  const floors = levelsNumber && levelsNumber > 0 ? Math.trunc(levelsNumber) : 1

  return {
    scene_id: sceneId,
    name: row.name || String(row.osm_id || 'unknown-building'),
    building_type: 'other',
    lat,
    lng,
    floors_count: floors,
    gate_node_id: null,
    cover_image_url: null,
  }
}

function mapFacility(row) {
  return {
    osm_id: osmIdToBigintString(row.osm_id),
    name: row.name || null,
    category: row.category || 'other',
    subtype: row.category || 'other',
    description: row.description || null,
    tags: row.tags || null,
    images: row.images || null,
    source: 'osm',
    geom: geometryToWkt(row.geom),
  }
}

function mapRoad(row) {
  return {
    osm_id: osmIdToBigintString(row.osm_id),
    highway_type: row.highway_type || null,
    tags: row.tags || null,
    geom: geometryToWkt(row.geom),
    length_m: typeof row.length_m === 'number' ? row.length_m : null,
  }
}

function mapIndoor(row) {
  const canUseLineGeom = row.geom && (row.geom.type === 'LineString' || row.geom.type === 'MultiLineString')
  return {
    building_id: null,
    level: row.level || null,
    tags: row.tags || null,
    geom: canUseLineGeom ? geometryToWkt(row.geom) : null,
  }
}

async function tableExists(supabase, table) {
  const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' }).limit(1)
  if (!error) return true
  if (error.message && error.message.includes(`Could not find the table 'public.${table}'`)) return false
  throw error
}

async function insertBatches(supabase, table, rows, batchSize) {
  let inserted = 0
  const batches = chunk(rows, batchSize)
  for (const batch of batches) {
    const { error } = await supabase.from(table).insert(batch)
    if (error) {
      throw new Error(`${table} insert failed: ${error.message}`)
    }
    inserted += batch.length
  }
  return inserted
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) throw new Error(`Missing env file: ${ENV_PATH}`)
  if (!fs.existsSync(DATA_PATH)) throw new Error(`Missing data file: ${DATA_PATH}`)

  const env = parseEnvFile(fs.readFileSync(ENV_PATH, 'utf8'))
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')

  const sceneId = getArg('scene-id', DEFAULT_SCENE_ID)
  const batchSize = Math.max(1, Number(getArg('batch-size', '200')) || 200)
  const limit = Math.max(0, Number(getArg('limit', '0')) || 0)
  const tableArg = getArg('tables', 'all')

  const selectedTables = tableArg === 'all'
    ? ['buildings', 'facilities', 'roads', 'indoor_paths']
    : tableArg.split(',').map(s => s.trim()).filter(Boolean)

  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))
  const data = {
    buildings: (raw.buildings || []).map(r => mapBuilding(r, sceneId)),
    facilities: (raw.facilities || []).map(mapFacility),
    roads: (raw.roads || []).map(mapRoad),
    indoor_paths: (raw.indoorPaths || []).map(mapIndoor),
  }

  for (const keyName of Object.keys(data)) {
    if (limit > 0) data[keyName] = data[keyName].slice(0, limit)
  }

  const supabase = createClient(url, key)

  const summary = []
  for (const table of selectedTables) {
    if (!Object.prototype.hasOwnProperty.call(data, table)) {
      summary.push({ table, status: 'skipped', reason: 'unknown table key' })
      continue
    }

    const exists = await tableExists(supabase, table)
    if (!exists) {
      summary.push({ table, status: 'skipped', reason: 'table not found in schema cache' })
      continue
    }

    const rows = data[table]
    if (!rows.length) {
      summary.push({ table, status: 'ok', inserted: 0 })
      continue
    }

    try {
      const inserted = await insertBatches(supabase, table, rows, batchSize)
      summary.push({ table, status: 'ok', inserted })
    } catch (err) {
      const message = err && err.message ? err.message : String(err)
      if (message.includes(`Could not find the table 'public.${table}'`)) {
        summary.push({ table, status: 'skipped', reason: 'table not found in schema cache during insert' })
        continue
      }
      throw err
    }
  }

  console.log(JSON.stringify({
    sceneId,
    batchSize,
    limit,
    selectedTables,
    summary,
  }, null, 2))
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})
