/*
Normalize BUPT Shahe OSM export into app-friendly categories.

Input:
  scripts/data/bupt_shahe.geojson

Outputs:
  scripts/data/bupt_shahe.normalized.json
  scripts/data/bupt_shahe.normalized.summary.json

Run:
  node scripts/osm/normalize_bupt_shahe.js
*/

const fs = require('fs')
const path = require('path')

const inputPath = path.join(__dirname, '..', 'data', 'bupt_shahe.geojson')
const outputPath = path.join(__dirname, '..', 'data', 'bupt_shahe.normalized.json')
const summaryPath = path.join(__dirname, '..', 'data', 'bupt_shahe.normalized.summary.json')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function cleanName(props) {
  return props.name || props['name:zh'] || props.ref || props.id || null
}

function classifyBuilding(props) {
  const building = props.building
  const amenity = props.amenity
  const office = props.office
  const tourism = props.tourism

  if (amenity === 'university' || amenity === 'college' || building === 'university') return '教学楼'
  if (amenity === 'library') return '图书馆'
  if (amenity === 'dormitory' || building === 'dormitory') return '宿舍楼'
  if (office || building === 'office') return '办公室'
  if (tourism === 'attraction') return '景点'
  if (building === 'school') return '教学楼'
  if (building === 'commercial') return '商业建筑'
  if (building === 'yes') return props.name ? '未细分建筑' : '泛化建筑'
  return building ? `建筑:${building}` : '未分类建筑'
}

function classifyFacility(props) {
  if (props.amenity === 'toilets') return '洗手间'
  if (props.amenity === 'restaurant') return '饭店'
  if (props.amenity === 'cafe') return '咖啡馆'
  if (props.amenity === 'fast_food') return '快餐'
  if (props.amenity === 'library') return '图书馆'
  if (props.amenity === 'canteen') return '食堂'
  if (props.amenity === 'school') return '教学服务'
  if (props.amenity === 'university') return '校园服务'
  if (props.amenity === 'bank') return '银行'
  if (props.amenity === 'atm') return 'ATM'
  if (props.amenity === 'pharmacy') return '药房'
  if (props.amenity === 'clinic') return '诊所'
  if (props.amenity === 'post_office') return '邮局'
  if (props.amenity === 'parking') return '停车场'
  if (props.amenity === 'bicycle_parking') return '自行车停车'
  if (props.amenity === 'vending_machine') return '自动售卖'

  if (props.shop === 'supermarket') return '超市'
  if (props.shop === 'convenience') return '便利店'
  if (props.shop === 'books') return '书店'
  if (props.shop === 'mall') return '商场'
  if (props.shop === 'bakery') return '面包店'
  if (props.shop === 'mobile_phone') return '手机店'
  if (props.shop === 'clothes') return '服装店'
  if (props.shop === 'stationery') return '文具店'

  if (props.tourism === 'information') return '服务中心'
  if (props.tourism === 'attraction') return '景点'

  if (props.leisure === 'sports_centre') return '体育中心'
  if (props.leisure === 'fitness_centre') return '健身'

  return null
}

function classifyRoad(props) {
  const highway = props.highway
  if (!highway) return null
  if (highway === 'footway' || highway === 'pedestrian' || highway === 'path') return '步行路'
  if (highway === 'steps') return '台阶'
  if (highway === 'cycleway') return '骑行路'
  if (highway === 'service') return '服务路'
  if (highway === 'residential' || highway === 'living_street') return '内部道路'
  return `road:${highway}`
}

function polygonCentroid(coords) {
  if (!coords || !coords.length) return null
  let lng = 0
  let lat = 0
  for (const pair of coords) {
    lng += pair[0]
    lat += pair[1]
  }
  return [lng / coords.length, lat / coords.length]
}

function getPoint(feature) {
  if (!feature.geometry) return null
  if (feature.geometry.type === 'Point') return feature.geometry.coordinates
  if (feature.geometry.type === 'Polygon') return polygonCentroid(feature.geometry.coordinates[0])
  if (feature.geometry.type === 'MultiPolygon') return polygonCentroid(feature.geometry.coordinates[0] && feature.geometry.coordinates[0][0])
  return null
}

function normalize() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing input file: ${inputPath}`)
  }

  const geojson = readJson(inputPath)
  const buildings = []
  const facilities = []
  const roads = []
  const indoorPaths = []

  const summary = {
    sourceFeatures: geojson.features.length,
    buildings: { total: 0, kinds: {} },
    facilities: { total: 0, kinds: {} },
    roads: { total: 0, kinds: {} },
    indoorPaths: { total: 0, kinds: {} },
  }

  const bump = (bucket, key) => {
    bucket[key] = (bucket[key] || 0) + 1
  }

  for (const feature of geojson.features) {
    const props = feature.properties || {}
    const name = cleanName(props)

    if (props.building !== undefined && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
      const kind = classifyBuilding(props)
      const point = getPoint(feature)
      buildings.push({
        osm_id: props.id || null,
        name,
        kind,
        tags: props,
        geom: feature.geometry,
        centroid: point ? { type: 'Point', coordinates: point } : null,
        entrance_points: [],
        levels: props.level || null,
        images: props.image ? [props.image] : [],
      })
      summary.buildings.total += 1
      bump(summary.buildings.kinds, kind)
    }

    const facilityKind = classifyFacility(props)
    if (facilityKind) {
      facilities.push({
        osm_id: props.id || null,
        name,
        category: facilityKind,
        description: props.description || null,
        tags: props,
        images: props.image ? [props.image] : [],
        source: 'osm',
        geom: feature.geometry.type === 'Point' ? feature.geometry : null,
      })
      summary.facilities.total += 1
      bump(summary.facilities.kinds, facilityKind)
    }

    const roadKind = classifyRoad(props)
    if (roadKind && (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString')) {
      roads.push({
        osm_id: props.id || null,
        highway_type: roadKind,
        tags: props,
        geom: feature.geometry,
        length_m: props.length || null,
      })
      summary.roads.total += 1
      bump(summary.roads.kinds, roadKind)
    }

    if (props.indoor !== undefined || props.level !== undefined || props.entrance !== undefined || props.door !== undefined) {
      indoorPaths.push({
        osm_id: props.id || null,
        level: props.level || null,
        tags: props,
        geom: feature.geometry,
      })
      summary.indoorPaths.total += 1
      bump(summary.indoorPaths.kinds, props.indoor !== undefined ? `indoor:${props.indoor}` : props.level !== undefined ? `level:${props.level}` : props.entrance !== undefined ? `entrance:${props.entrance}` : `door:${props.door}`)
    }
  }

  summary.facilities.distinctKinds = Object.keys(summary.facilities.kinds).length

  const normalized = { buildings, facilities, roads, indoorPaths }
  fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2))
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))

  console.log('Wrote normalized data to', outputPath)
  console.log('Wrote normalized summary to', summaryPath)
  console.log(JSON.stringify(summary, null, 2))
}

normalize()
