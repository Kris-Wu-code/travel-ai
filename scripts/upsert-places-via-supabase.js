/*
Upsert normalized POIs into `places` via Supabase REST/API.

Usage:
  node scripts/upsert-places-via-supabase.js --input=scripts/data/bupt_shahe.normalized.json
  node scripts/upsert-places-via-supabase.js --input=scripts/data/bupt_shahe.normalized.json --batch-size=200 --dry-run=true
*/

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const ROOT = path.join(__dirname, '..')
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

function toBool(v) {
  return String(v).toLowerCase() === 'true'
}

function chunk(array, size) {
  const out = []
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size))
  return out
}

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function ringToWkt(ring) {
  return ring
    .map(pt => `${toFiniteNumber(pt[0]) ?? 0} ${toFiniteNumber(pt[1]) ?? 0}`)
    .join(', ')
}

function geometryToWkt(geometry) {
  if (!geometry || !geometry.type || !Array.isArray(geometry.coordinates)) return null
  const c = geometry.coordinates
  if (geometry.type === 'Point') return `POINT(${toFiniteNumber(c[0]) ?? 0} ${toFiniteNumber(c[1]) ?? 0})`
  if (geometry.type === 'LineString') return `LINESTRING(${ringToWkt(c)})`
  if (geometry.type === 'Polygon') return `POLYGON(${c.map(r => `(${ringToWkt(r)})`).join(', ')})`
  if (geometry.type === 'MultiLineString') return `MULTILINESTRING(${c.map(l => `(${ringToWkt(l)})`).join(', ')})`
  if (geometry.type === 'MultiPolygon') {
    return `MULTIPOLYGON(${c.map(poly => `(${poly.map(r => `(${ringToWkt(r)})`).join(', ')})`).join(', ')})`
  }
  return null
}

function pointFromItem(item) {
  if (item && item.lng != null && item.lat != null) return [toFiniteNumber(item.lng), toFiniteNumber(item.lat)]
  if (item && item.lon != null && item.lat != null) return [toFiniteNumber(item.lon), toFiniteNumber(item.lat)]
  if (item && item.geometry && item.geometry.type === 'Point' && Array.isArray(item.geometry.coordinates)) {
    return [toFiniteNumber(item.geometry.coordinates[0]), toFiniteNumber(item.geometry.coordinates[1])]
  }
  if (item && item.geom && item.geom.type === 'Point' && Array.isArray(item.geom.coordinates)) {
    return [toFiniteNumber(item.geom.coordinates[0]), toFiniteNumber(item.geom.coordinates[1])]
  }
  if (item && item.centroid && item.centroid.type === 'Point' && Array.isArray(item.centroid.coordinates)) {
    return [toFiniteNumber(item.centroid.coordinates[0]), toFiniteNumber(item.centroid.coordinates[1])]
  }
  return [null, null]
}

function normalizeInput(raw) {
  if (Array.isArray(raw)) return raw

  if (raw && Array.isArray(raw.features)) {
    return raw.features.map(f => ({ ...f.properties, geometry: f.geometry }))
  }

  const out = []
  if (raw && typeof raw === 'object') {
    for (const [key, arr] of Object.entries(raw)) {
      if (!Array.isArray(arr)) continue
      for (const it of arr) {
        out.push({ ...it, _bucket: key })
      }
    }
  }
  return out
}

function mapRow(item) {
  const source = item.source || item.provider || 'osm'
  const sourceId = item.source_id || item.osm_id || item.id || (item.tags && item.tags.id) || null
  if (!sourceId) return null

  const [lng, lat] = pointFromItem(item)
  let geom = null
  if (lng != null && lat != null) geom = `POINT(${lng} ${lat})`

  return {
    osm_id: (() => {
      const m = String(item.osm_id || '').match(/(\d+)/)
      return m ? m[1] : null
    })(),
    source,
    source_id: String(sourceId),
    name: item.name || (item.tags && item.tags.name) || null,
    category: item.category || item.kind || item.highway_type || item._bucket || 'other',
    subtype: item.subtype || item.sub_type || null,
    description: item.description || null,
    tags: item.tags || null,
    images: item.images || null,
    rating: toFiniteNumber(item.rating),
    raw: item.raw || item,
    geom,
  }
}

function extractMissingColumnFromError(message) {
  // Example: Could not find the 'rating' column of 'places' in the schema cache
  const m = String(message || '').match(/Could not find the '([^']+)' column of 'places'/)
  return m ? m[1] : null
}

async function main() {
  const inputPath = path.resolve(process.cwd(), getArg('input', 'scripts/data/bupt_shahe.normalized.json'))
  const batchSize = Math.max(1, Number(getArg('batch-size', '200')) || 200)
  const dryRun = toBool(getArg('dry-run', 'false'))

  if (!fs.existsSync(inputPath)) throw new Error(`Missing input file: ${inputPath}`)
  if (!fs.existsSync(ENV_PATH)) throw new Error(`Missing env file: ${ENV_PATH}`)

  const env = parseEnvFile(fs.readFileSync(ENV_PATH, 'utf8'))
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  const normalized = normalizeInput(raw)
  const mappedRows = normalized.map(mapRow).filter(Boolean)
  const dedupMap = new Map()
  for (const r of mappedRows) {
    dedupMap.set(`${r.source}::${r.source_id}`, r)
  }
  const rows = [...dedupMap.values()]

  const summary = {
    inputPath,
    totalInput: normalized.length,
    preparedRows: rows.length,
    batchSize,
    dryRun,
    upserted: 0,
  }

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  const supabase = createClient(url, key)

  // Keep this set dynamic: if schema cache says a column doesn't exist, drop it and retry.
  const blockedColumns = new Set()

  async function fallbackUpsertWithoutConstraint(batch) {
    const keys = batch
      .map(r => ({ source: r.source, source_id: r.source_id }))
      .filter(k => k.source && k.source_id)

    if (!keys.length) return 0

    const uniqueSources = [...new Set(keys.map(k => k.source))]
    const uniqueSourceIds = [...new Set(keys.map(k => k.source_id))]

    const { data: existingRows, error: existingErr } = await supabase
      .from('places')
      .select('id, source, source_id')
      .in('source', uniqueSources)
      .in('source_id', uniqueSourceIds)

    if (existingErr) throw new Error(`places fallback select failed: ${existingErr.message}`)

    const pairToId = new Map()
    for (const row of existingRows || []) {
      const k = `${row.source}::${row.source_id}`
      if (!pairToId.has(k)) pairToId.set(k, row.id)
    }

    const toInsert = []
    const toUpdate = []
    for (const row of batch) {
      const k = `${row.source}::${row.source_id}`
      const id = pairToId.get(k)
      if (id) toUpdate.push({ id, row })
      else toInsert.push(row)
    }

    if (toInsert.length) {
      const { error: insertErr } = await supabase.from('places').insert(toInsert)
      if (insertErr) throw new Error(`places fallback insert failed: ${insertErr.message}`)
    }

    // Update row-by-row to avoid requiring a unique constraint.
    for (const item of toUpdate) {
      const { error: updateErr } = await supabase.from('places').update(item.row).eq('id', item.id)
      if (updateErr) throw new Error(`places fallback update failed: ${updateErr.message}`)
    }

    return toInsert.length + toUpdate.length
  }

  for (const batch of chunk(rows, batchSize)) {
    let current = batch
    let retries = 0
    while (retries < 8) {
      const payload = current.map(row => {
        const out = { ...row }
        for (const c of blockedColumns) delete out[c]
        return out
      })

      if (!payload.length) break

      if (!payload[0].source || !payload[0].source_id) {
        throw new Error('places upsert blocked: `source` or `source_id` missing in payload after column filtering.')
      }

      const { error } = await supabase
        .from('places')
        .upsert(payload, { onConflict: 'source,source_id', ignoreDuplicates: false })

      if (!error) {
        summary.upserted += payload.length
        break
      }

      const missing = extractMissingColumnFromError(error.message)
      if (missing) {
        if (missing === 'source' || missing === 'source_id' || missing === 'raw') {
          throw new Error(
            `places upsert blocked: required column \`${missing}\` not found. ` +
            'Please apply migration scripts/migrations/20260525_create_places_schema_postgis.sql first.'
          )
        }
        blockedColumns.add(missing)
        retries += 1
        continue
      }

      const msg = String(error.message || '')
      if (msg.includes('there is no unique or exclusion constraint matching the ON CONFLICT specification')) {
        const done = await fallbackUpsertWithoutConstraint(payload)
        summary.upserted += done
        break
      }

      throw new Error(`places upsert failed: ${error.message}`)
    }
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})
