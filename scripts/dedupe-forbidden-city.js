/*
Deduplicate duplicated import rows for Forbidden City tables.

Default tables:
  buildings, facilities

Usage:
  node scripts/dedupe-forbidden-city.js
  node scripts/dedupe-forbidden-city.js --tables=buildings,facilities
  node scripts/dedupe-forbidden-city.js --dry-run=true
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

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    const out = {}
    for (const key of keys) out[key] = stableValue(value[key])
    return out
  }
  return value
}

function rowFingerprint(row) {
  const cleaned = {}
  const ignoredCols = new Set(['id', 'created_at', 'updated_at'])
  const keys = Object.keys(row).filter(k => !ignoredCols.has(k)).sort()
  for (const key of keys) {
    cleaned[key] = stableValue(row[key])
  }
  return JSON.stringify(cleaned)
}

async function dedupeTable(supabase, table, dryRun) {
  const pageSize = 1000
  const rows = []
  let from = 0

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await supabase.from(table).select('*').range(from, to)
    if (error) throw new Error(`${table} select failed: ${error.message}`)
    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }

  const seen = new Map()
  const duplicates = []

  for (const row of rows) {
    const fp = rowFingerprint(row)
    if (seen.has(fp)) {
      duplicates.push(row.id)
    } else {
      seen.set(fp, row.id)
    }
  }

  if (duplicates.length === 0) {
    return { table, total: rows.length, duplicates: 0, deleted: 0 }
  }

  if (dryRun) {
    return { table, total: rows.length, duplicates: duplicates.length, deleted: 0 }
  }

  let deleted = 0
  for (const ids of chunk(duplicates, 500)) {
    const { error: delError } = await supabase.from(table).delete().in('id', ids)
    if (delError) throw new Error(`${table} delete failed: ${delError.message}`)
    deleted += ids.length
  }

  return { table, total: rows.length, duplicates: duplicates.length, deleted }
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) throw new Error(`Missing env file: ${ENV_PATH}`)

  const env = parseEnvFile(fs.readFileSync(ENV_PATH, 'utf8'))
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')

  const tableArg = getArg('tables', 'buildings,facilities')
  const dryRun = getArg('dry-run', 'false') === 'true'
  const tables = tableArg.split(',').map(s => s.trim()).filter(Boolean)

  const supabase = createClient(url, key)

  const summary = []
  for (const table of tables) {
    summary.push(await dedupeTable(supabase, table, dryRun))
  }

  console.log(JSON.stringify({ dryRun, tables, summary }, null, 2))
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})
