/*
Normalize Badaling geojson into simplified POI lists with limited, important points.
Outputs:
  scripts/data/badaling.normalized.json
  scripts/data/badaling.normalized.summary.json

Goal: keep only key POIs (entrances, ticket offices, viewpoints, museums, toilets, parking, food, transport).
*/

const fs = require('fs')
const path = require('path')

const inputPath = path.join(__dirname, '..', 'data', 'badaling.geojson')
const outputPath = path.join(__dirname, '..', 'data', 'badaling.normalized.json')
const summaryPath = path.join(__dirname, '..', 'data', 'badaling.normalized.summary.json')

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')) }

function pointFromFeature(feature) {
  const g = feature.geometry
  if (!g) return null
  if (g.type === 'Point') return g.coordinates
  if (g.type === 'Polygon') {
    const ring = g.coordinates[0]
    if (!ring || !ring.length) return null
    let lng = 0, lat = 0
    for (const p of ring) { lng += p[0]; lat += p[1] }
    return [lng / ring.length, lat / ring.length]
  }
  if (g.type === 'MultiPolygon') {
    const ring = g.coordinates[0] && g.coordinates[0][0]
    if (!ring) return null
    let lng = 0, lat = 0
    for (const p of ring) { lng += p[0]; lat += p[1] }
    return [lng / ring.length, lat / ring.length]
  }
  return null
}

function classify(props) {
  if (!props) return null
  if (props.tourism === 'museum') return 'museum'
  if (props.entrance !== undefined) return 'entrance'
  if (props.entrance === 'yes') return 'entrance'
  if (props.amenity === 'toilets') return 'toilet'
  if (props.amenity === 'restaurant' || props.amenity === 'cafe' || props.amenity === 'fast_food') return 'food'
  if (props.shop === 'ticket' || props.tourism === 'ticket') return 'ticket'
  if (props.amenity === 'parking' || props.parking === 'yes') return 'parking'
  if (props.highway === 'bus_stop' || props.public_transport === 'stop_position' || props.bus === 'yes') return 'transport'
  if (props.tourism === 'viewpoint' || props.historic === 'viewpoint') return 'viewpoint'
  // default: treat notable named features as potential POI
  if (props.name && props.name.length < 120) return 'poi'
  return null
}

function normalize() {
  if (!fs.existsSync(inputPath)) throw new Error(`Missing input file: ${inputPath}`)
  const geo = readJson(inputPath)
  const features = geo.features || []

  const buckets = {
    entrance: [], ticket: [], museum: [], viewpoint: [], toilet: [], food: [], parking: [], transport: [], poi: []
  }

  for (const f of features) {
    const props = f.properties || {}
    const cat = classify(props)
    if (!cat) continue
    const pt = pointFromFeature(f)
    const name = props.name || props.ref || props.id || null
    const item = {
      osm_id: props.id || props['@id'] || null,
      name,
      category: cat,
      tags: props,
      geom: f.geometry || null,
      lat: pt ? pt[1] : null,
      lng: pt ? pt[0] : null,
    }
    if (buckets[cat]) buckets[cat].push(item)
  }

  // For UX reasons, limit numbers: keep most important per category
  function pickTop(arr, limit) {
    // prefer named items, then by presence of useful tags
    arr.sort((a, b) => {
      const an = a.name ? 0 : 1
      const bn = b.name ? 0 : 1
      return an - bn
    })
    return arr.slice(0, limit)
  }

  const result = []
  result.push(...pickTop(buckets.entrance, 10))
  result.push(...pickTop(buckets.ticket, 5))
  result.push(...pickTop(buckets.museum, 5))
  result.push(...pickTop(buckets.viewpoint, 20))
  result.push(...pickTop(buckets.toilet, 10))
  result.push(...pickTop(buckets.food, 10))
  result.push(...pickTop(buckets.parking, 5))
  result.push(...pickTop(buckets.transport, 10))
  // a few generic POIs
  result.push(...pickTop(buckets.poi, 20))

  // produce summary
  const summary = {
    totalFeatures: features.length,
    extracted: result.length,
    byCategory: Object.fromEntries(Object.keys(buckets).map(k => [k, buckets[k].length]))
  }

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8')
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
  console.log('Wrote normalized', outputPath, 'summary:', summary)
}

normalize()
