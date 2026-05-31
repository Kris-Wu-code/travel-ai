/*
Link `places` rows to `buildings` by spatial containment and nearest fallback.

Usage:
  node scripts/osm/link_places_to_buildings.js --dataset=badaling
  node scripts/osm/link_places_to_buildings.js --dataset=badaling --threshold=30
*/

const fs = require('fs')
const path = require('path')
const dns = require('dns')
const { Pool } = require('pg')

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

function parseDatabaseUrl(databaseUrl) {
  const parsed = new URL(databaseUrl)
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, '') || 'postgres',
  }
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) throw new Error(`Missing env file: ${ENV_PATH}`)
  const env = parseEnvFile(fs.readFileSync(ENV_PATH, 'utf8'))
  const databaseUrl = env.DATABASE_URL || env.SUPABASE_DB_URL || env.PG_DATABASE_URL
  if (!databaseUrl) throw new Error('Missing DATABASE_URL / SUPABASE_DB_URL in .env.local')

  const dataset = getArg('dataset', null)
  const threshold = toNumber(getArg('threshold', '30'), 30) // meters for nearest fallback

  const db = parseDatabaseUrl(databaseUrl)
  let connectHost = db.host
  try {
    const ipv4 = await dns.promises.resolve4(db.host)
    if (Array.isArray(ipv4) && ipv4.length) connectHost = ipv4[0]
    console.log(`[link] Resolved ${db.host} -> ${connectHost}`)
  } catch (e) {
    console.log(`[link] IPv4 resolve failed for ${db.host}, using hostname`)
  }
  const pool = new Pool({
    host: connectHost,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
    ssl: { rejectUnauthorized: false },
    family: 4,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 1,
    lookup(hostname, options, callback) {
      return dns.lookup(hostname, { ...options, family: 4 }, callback)
    },
  })
  const client = await pool.connect()

  try {
    console.log('[link] Step 1: assign building_id where point is within a building polygon')
    const containmentSql = `
      UPDATE places p
      SET building_id = b.id
      FROM buildings b
      WHERE p.building_id IS NULL
        AND ST_Contains(b.geom, p.geom::geometry)
    `
    await client.query(containmentSql)
    console.log('[link] Containment update executed')

    console.log('[link] Step 2: nearest-building fallback for unmatched places')
    const nearestSql = `
      WITH unmatched AS (
        SELECT id, geom FROM places WHERE building_id IS NULL
      ), nearest AS (
        SELECT u.id AS place_id, b.id AS building_id,
               ST_Distance(b.geom::geography, u.geom::geography) AS d
        FROM unmatched u
        CROSS JOIN LATERAL (
          SELECT id, geom FROM buildings ORDER BY ST_Distance(buildings.geom::geography, u.geom::geography) LIMIT 1
        ) b
      )
      UPDATE places p
      SET building_id = nearest.building_id
      FROM nearest
      WHERE p.id = nearest.place_id AND nearest.d <= $1
      RETURNING p.id
    `

    const res = await client.query(nearestSql, [threshold])
    console.log(`[link] Nearest fallback updated ${res.rowCount} places (threshold ${threshold}m)`)

    console.log('[link] Done')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})
