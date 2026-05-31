/*
Fetch OSM data for Badaling Great Wall (八达岭长城) using Overpass API.
Run: node scripts/osm/fetch_badaling_overpass.js
*/

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const osmtogeojson = require('osmtogeojson')

// Bounding box for Badaling area (south, west, north, east)
const BBOX = {
  south: 40.350,
  west: 116.005,
  north: 40.380,
  east: 116.035,
}

const outDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
]

async function postOverpassQuery(endpoint, query) {
  const body = new URLSearchParams({ data: query }).toString()
  return axios.post(endpoint, body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/json',
      'User-Agent': 'travel-ai/1.0 (OSM Overpass fetcher)'
    },
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  })
}

async function fetchOverpass() {
  const bbox = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`
  const query = `[
out:json][timeout:60];
(
  way["building"](${bbox});
  relation["building"](${bbox});
  node["amenity"](${bbox});
  node["shop"](${bbox});
  node["tourism"](${bbox});
  node["leisure"](${bbox});
  node["historic"](${bbox});
  way["highway"](${bbox});
  node["entrance"](${bbox});
  node["door"](${bbox});
  node["bus"](${bbox});
  node["public_transport"](${bbox});
);
out body;\n>;
out skel qt;`

  console.log('Posting Overpass query for Badaling...')
  let res = null
  let lastError = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await postOverpassQuery(endpoint, query)
      if (response.status === 200) {
        res = response
        console.log('Overpass endpoint succeeded:', endpoint)
        break
      }
      lastError = new Error(`HTTP ${response.status} from ${endpoint}`)
      console.warn('Overpass endpoint failed:', endpoint, 'status=', response.status)
    } catch (err) {
      lastError = err
      console.warn('Overpass endpoint error:', endpoint, err && err.message ? err.message : err)
    }
  }

  if (!res) throw lastError || new Error('All Overpass endpoints failed')

  const osmJson = res.data
  const geojson = osmtogeojson(osmJson)

  const osmPath = path.join(outDir, 'badaling.osm.json')
  const geoPath = path.join(outDir, 'badaling.geojson')
  fs.writeFileSync(osmPath, JSON.stringify(osmJson, null, 2))
  fs.writeFileSync(geoPath, JSON.stringify(geojson, null, 2))

  console.log('Saved OSM JSON to', osmPath)
  console.log('Saved GeoJSON to', geoPath)

  // quick stats
  const stats = {
    totalFeatures: geojson.features.length,
    buildings: 0,
    facilities: 0,
    roads: 0,
  }
  for (const feature of geojson.features) {
    const props = feature.properties || {}
    if (props.building !== undefined) stats.buildings += 1
    if (props.amenity !== undefined || props.shop !== undefined || props.tourism !== undefined) stats.facilities += 1
    if (props.highway !== undefined) stats.roads += 1
  }

  const statsPath = path.join(outDir, 'badaling_stats.json')
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2))
  console.log('Wrote stats to', statsPath)
}

fetchOverpass().catch(err => {
  console.error('Fetch failed:', err && err.message ? err.message : err)
  process.exit(1)
})
