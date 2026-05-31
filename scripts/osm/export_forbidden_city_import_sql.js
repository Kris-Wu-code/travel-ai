/*
Export normalized Forbidden City data into a Supabase-friendly SQL import file.

Input:
  scripts/data/forbidden_city.normalized.json

Output:
  scripts/data/forbidden_city.import.sql

Run:
  node scripts/osm/export_forbidden_city_import_sql.js
*/

const fs = require('fs')
const path = require('path')

const inputPath = path.join(__dirname, '..', 'data', 'forbidden_city.normalized.json')
const outputPath = path.join(__dirname, '..', 'data', 'forbidden_city.import.sql')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

function sqlBigint(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value))
  const match = String(value).match(/(\d+)/)
  return match ? match[1] : 'NULL'
}

function sqlJson(value) {
  if (value === null || value === undefined) return 'NULL'
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
}

function sqlGeom(geometry) {
  if (!geometry) return 'NULL'
  return `ST_SetSRID(ST_GeomFromGeoJSON('${JSON.stringify(geometry).replace(/'/g, "''")}'), 4326)`
}

function sqlPointFromGeometry(geometry) {
  if (!geometry) return 'NULL'
  if (geometry.type === 'Point') return sqlGeom(geometry)
  return sqlGeom(geometry)
}

function chunk(array, size) {
  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

function toBuildingsInsert(rows) {
  if (!rows.length) return ''
  const values = rows.map(row => `(
    ${sqlBigint(row.osm_id)},
    ${sqlString(row.name)},
    ${sqlString(row.kind)},
    ${sqlJson(row.tags)},
    ${sqlGeom(row.geom)},
    ${sqlPointFromGeometry(row.centroid)},
    ${sqlJson(row.entrance_points)},
    ${sqlString(row.levels)},
    ${sqlJson(row.images)}
  )`).join(',\n')

  return `INSERT INTO buildings (osm_id, name, kind, tags, geom, centroid, entrance_points, levels, images) VALUES\n${values};\n`
}

function toFacilitiesInsert(rows) {
  if (!rows.length) return ''
  const values = rows.map(row => `(
    ${sqlBigint(row.osm_id)},
    ${sqlString(row.name)},
    ${sqlString(row.category)},
    ${sqlString(row.category)},
    ${sqlString(row.description)},
    ${sqlJson(row.tags)},
    ${sqlJson(row.images)},
    ${sqlString('osm')},
    ${sqlPointFromGeometry(row.geom)}
  )`).join(',\n')

  return `INSERT INTO facilities (osm_id, name, category, subtype, description, tags, images, source, geom) VALUES\n${values};\n`
}

function toRoadsInsert(rows) {
  if (!rows.length) return ''
  const values = rows.map(row => `(
    ${sqlBigint(row.osm_id)},
    ${sqlString(row.highway_type)},
    ${sqlJson(row.tags)},
    ${sqlGeom(row.geom)},
    ${row.length_m === null || row.length_m === undefined ? 'NULL' : row.length_m}
  )`).join(',\n')

  return `INSERT INTO roads (osm_id, highway_type, tags, geom, length_m) VALUES\n${values};\n`
}

function toIndoorInsert(rows) {
  if (!rows.length) return ''
  const values = rows.map(row => `(
    ${row.building_id === null || row.building_id === undefined ? 'NULL' : row.building_id},
    ${sqlString(row.level)},
    ${sqlJson(row.tags)},
    ${sqlGeom(row.geom)}
  )`).join(',\n')

  return `INSERT INTO indoor_paths (building_id, level, tags, geom) VALUES\n${values};\n`
}

function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing normalized file: ${inputPath}`)
  }

  const data = readJson(inputPath)
  const parts = [
    '-- Auto-generated import SQL for Forbidden City OSM normalization',
    'BEGIN;',
  ]

  for (const buildingsChunk of chunk(data.buildings || [], 200)) {
    parts.push(toBuildingsInsert(buildingsChunk))
  }

  for (const facilitiesChunk of chunk(data.facilities || [], 200)) {
    parts.push(toFacilitiesInsert(facilitiesChunk))
  }

  for (const roadsChunk of chunk(data.roads || [], 200)) {
    parts.push(toRoadsInsert(roadsChunk))
  }

  for (const indoorChunk of chunk(data.indoorPaths || [], 200)) {
    parts.push(toIndoorInsert(indoorChunk))
  }

  parts.push('COMMIT;')

  fs.writeFileSync(outputPath, parts.filter(Boolean).join('\n'))
  console.log('Wrote import SQL to', outputPath)
}

main()
