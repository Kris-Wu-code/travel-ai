/*
Fetch OSM data for Beijing Forbidden City (故宫) using Overpass API.
- Edit BBOX if needed.
- Requires: npm i axios osmtogeojson
- Run: node fetch_forbidden_city_overpass.js
*/

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const osmtogeojson = require('osmtogeojson')

// Bounding box for the Forbidden City (south,west,north,east)
// Tweak if you want larger/smaller area
const BBOX = {
  south: 39.9120,
  west: 116.3890,
  north: 39.9250,
  east: 116.4070,
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
      'User-Agent': 'travel-ai/1.0 (OSM Overpass fetcher; contact: local-dev)',
    },
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  })
}

async function fetchOverpass() {
  // Query: buildings, amenities, shops, tourism, highway (paths), entrances, indoor features
  const bbox = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`
  const query = `[
  out:json][timeout:60];
(
  // buildings (including building polygons)
  way["building"](${bbox});
  relation["building"](${bbox});
  // POIs: amenities, shops, tourism
  node["amenity"](${bbox});
  node["shop"](${bbox});
  node["tourism"](${bbox});
  node["leisure"](${bbox});
  node["historic"](${bbox});
  // highways (footways, paths, primary for context)
  way["highway"](${bbox});
  // entrances/doors/indoor tags
  node["entrance"](${bbox});
  node["door"](${bbox});
  node["indoor"](${bbox});
  // relations for multipolygons
  relation["type"="multipolygon"]["building"](${bbox});
);
out body;
>;
out skel qt;`

  console.log('Posting Overpass query...')
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

  if (!res) {
    throw lastError || new Error('All Overpass endpoints failed')
  }

  const osmJson = res.data
  const geojson = osmtogeojson(osmJson)

  const osmPath = path.join(outDir, 'forbidden_city.osm.json')
  const geoPath = path.join(outDir, 'forbidden_city.geojson')
  fs.writeFileSync(osmPath, JSON.stringify(osmJson, null, 2))
  fs.writeFileSync(geoPath, JSON.stringify(geojson, null, 2))

  console.log('Saved OSM JSON to', osmPath)
  console.log('Saved GeoJSON to', geoPath)

  // produce a meaningful stats summary for buildings / facilities / roads
  const stats = {
    totalFeatures: geojson.features.length,
    buildings: {
      total: 0,
      kinds: {},
    },
    facilities: {
      total: 0,
      kinds: {},
    },
    roads: {
      total: 0,
      kinds: {},
    },
    indoor: {
      total: 0,
      kinds: {},
    },
    samples: {
      buildings: [],
      facilities: [],
      roads: [],
    },
  }

  function bump(bucket, key) {
    bucket[key] = (bucket[key] || 0) + 1
  }

  function pushSample(target, item) {
    if (target.length < 20) target.push(item)
  }

  for (const feature of geojson.features) {
    const props = feature.properties || {}
    const name = props.name || props.ref || props.id || 'unknown'

    if (props.building !== undefined) {
      stats.buildings.total += 1
      bump(stats.buildings.kinds, String(props.building))
      pushSample(stats.samples.buildings, { name, building: String(props.building), id: props.id || null })
    }

    const facilityType = props.amenity || props.shop || props.tourism || props.leisure || props.historic || null
    if (facilityType !== null) {
      stats.facilities.total += 1
      const key = props.amenity !== undefined
        ? `amenity:${props.amenity}`
        : props.shop !== undefined
          ? `shop:${props.shop}`
          : props.tourism !== undefined
            ? `tourism:${props.tourism}`
            : props.leisure !== undefined
              ? `leisure:${props.leisure}`
              : `historic:${props.historic}`
      bump(stats.facilities.kinds, key)
      pushSample(stats.samples.facilities, { name, kind: key, id: props.id || null })
    }

    if (props.highway !== undefined) {
      stats.roads.total += 1
      bump(stats.roads.kinds, String(props.highway))
      pushSample(stats.samples.roads, { name, highway: String(props.highway), id: props.id || null })
    }

    if (props.indoor !== undefined || props.level !== undefined || props.entrance !== undefined || props.door !== undefined) {
      stats.indoor.total += 1
      const key = props.indoor !== undefined
        ? `indoor:${props.indoor}`
        : props.level !== undefined
          ? `level:${props.level}`
          : props.entrance !== undefined
            ? `entrance:${props.entrance}`
            : `door:${props.door}`
      bump(stats.indoor.kinds, key)
    }
  }

  const statsPath = path.join(outDir, 'forbidden_city_stats.json')
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2))
  console.log('Wrote quick stats to', statsPath)
}

fetchOverpass().catch(err => {
  console.error('Fetch failed:', err && err.message)
  process.exit(1)
})
