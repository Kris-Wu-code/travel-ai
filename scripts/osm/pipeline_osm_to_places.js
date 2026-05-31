/*
One-command pipeline: fetch -> normalize -> upsert into places (Supabase API) -> verify.

Usage:
  node scripts/osm/pipeline_osm_to_places.js --dataset=bupt_shahe
  node scripts/osm/pipeline_osm_to_places.js --dataset=forbidden_city
  node scripts/osm/pipeline_osm_to_places.js --dataset=bupt_shahe --skip-fetch=true --skip-normalize=true --dry-run=true
*/

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
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

function toBool(v) {
  return String(v).toLowerCase() === 'true'
}

function runNodeScript(scriptPath, args = []) {
  const fullScriptPath = path.join(ROOT, scriptPath)
  const result = spawnSync(process.execPath, [fullScriptPath, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    throw new Error(`Step failed: node ${scriptPath} ${args.join(' ')}`)
  }
}

function chunk(array, size) {
  const out = []
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size))
  return out
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
      for (const it of arr) out.push({ ...it, _bucket: key })
    }
  }
  return out
}

function buildExpectedKeys(inputPath) {
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  const rows = normalizeInput(raw)
  const keys = new Set()
  for (const item of rows) {
    const source = item.source || item.provider || 'osm'
    const sourceId = item.source_id || item.osm_id || item.id || (item.tags && item.tags.id)
    if (!sourceId) continue
    keys.add(`${source}::${String(sourceId)}`)
  }
  return keys
}

async function verifyImportedRows(inputPath) {
  if (!fs.existsSync(ENV_PATH)) throw new Error(`Missing env file: ${ENV_PATH}`)
  const env = parseEnvFile(fs.readFileSync(ENV_PATH, 'utf8'))
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')

  const expected = [...buildExpectedKeys(inputPath)]
  const expectedObjects = expected.map(k => {
    const [source, source_id] = k.split('::')
    return { source, source_id }
  })

  const supabase = createClient(url, key)
  let found = 0
  for (const bySource of groupBySource(expectedObjects)) {
    const source = bySource.source
    for (const ids of chunk(bySource.sourceIds, 200)) {
      const { data, error } = await supabase
        .from('places')
        .select('source_id')
        .eq('source', source)
        .in('source_id', ids)
      if (error) throw new Error(`verify query failed: ${error.message}`)
      found += (data || []).length
    }
  }

  const coverage = expected.length ? (found / expected.length) : 1
  return {
    expectedRows: expected.length,
    foundRows: found,
    coverage,
  }
}

function groupBySource(items) {
  const map = new Map()
  for (const it of items) {
    if (!map.has(it.source)) map.set(it.source, [])
    map.get(it.source).push(it.source_id)
  }
  return [...map.entries()].map(([source, sourceIds]) => ({ source, sourceIds }))
}

async function main() {
  const dataset = getArg('dataset', 'bupt_shahe')
  const skipFetch = toBool(getArg('skip-fetch', 'false'))
  const skipNormalize = toBool(getArg('skip-normalize', 'false'))
  const dryRun = toBool(getArg('dry-run', 'false'))

  const defs = require('./datasets.config')

  const def = defs[dataset]
  if (!def) throw new Error(`Unsupported dataset: ${dataset}`)
  if (!def.fetchScript || !def.normalizeScript || !def.normalizedFile) {
    throw new Error(`Dataset config incomplete for ${dataset}`)
  }

  const inputPath = path.isAbsolute(def.normalizedFile)
    ? def.normalizedFile
    : path.join(ROOT, def.normalizedFile)

  console.log(`[pipeline] dataset=${dataset} label=${def.label || dataset} skipFetch=${skipFetch} skipNormalize=${skipNormalize} dryRun=${dryRun}`)

  if (!skipFetch) {
    console.log('[pipeline] step fetch...')
    runNodeScript(def.fetchScript)
  }

  if (!skipNormalize) {
    console.log('[pipeline] step normalize...')
    runNodeScript(def.normalizeScript)
  }

  console.log('[pipeline] step upsert...')
  const upsertArgs = [`--input=${path.relative(ROOT, inputPath)}`]
  if (dryRun) upsertArgs.push('--dry-run=true')
  runNodeScript('scripts/upsert-places-via-supabase.js', upsertArgs)

  if (!dryRun) {
    console.log('[pipeline] step link-places-to-buildings...')
    // Prefer the Supabase API path, which matches the previously working import flow.
    // It falls back to raw._linked_building_id when the formal column is not yet present.
    runNodeScript('scripts/osm/link_places_to_buildings_via_supabase.js', [`--dataset=${dataset}`])
  }

  if (!dryRun) {
    console.log('[pipeline] step verify...')
    const report = await verifyImportedRows(inputPath)
    console.log(JSON.stringify({ dataset, verify: report }, null, 2))
    const coverageThreshold = typeof def.coverageThreshold === 'number' ? def.coverageThreshold : 0.98
    if (report.coverage < coverageThreshold) {
      throw new Error(`Low coverage after import: ${report.foundRows}/${report.expectedRows}`)
    }
  }

  console.log('[pipeline] done')
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})
