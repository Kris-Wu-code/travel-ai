/*
Normalize the Forbidden City OSM export into app-friendly categories.

Input:
  scripts/data/forbidden_city.geojson

Outputs:
  scripts/data/forbidden_city.normalized.json
  scripts/data/forbidden_city.normalized.summary.json

Run:
  node scripts/osm/normalize_forbidden_city.js
*/

const fs = require('fs')
const path = require('path')

const inputPath = path.join(__dirname, '..', 'data', 'forbidden_city.geojson')
const outputPath = path.join(__dirname, '..', 'data', 'forbidden_city.normalized.json')
const summaryPath = path.join(__dirname, '..', 'data', 'forbidden_city.normalized.summary.json')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function cleanName(props) {
  return props.name || props.ref || props.id || null
}

function isNoiseBuilding(props) {
  const building = props.building
  const historic = props.historic
  const tourism = props.tourism
  const amenity = props.amenity
  const shop = props.shop

  if (building === 'wall') return true
  if (building === 'roof') return true
  if (building === 'bridge') return true
  if (building === 'shed' && !props.name) return true
  if (historic === 'city_gate' && !props.name) return true
  if (tourism === 'viewpoint' && !props.name) return true
  if (amenity === 'bench' || amenity === 'waste_basket') return true
  if (shop && !props.name && building === undefined) return true

  return false
}

function classifyBuilding(props) {
  const building = props.building
  const historic = props.historic
  const tourism = props.tourism
  const amenity = props.amenity

  if (historic === 'palace') return '景点/宫殿'
  if (historic === 'temple') return '宗教建筑'
  if (historic === 'city_gate') return '城门/入口建筑'
  if (historic === 'memorial') return '纪念设施'
  if (tourism === 'museum') return '博物馆'
  if (tourism === 'hotel') return '酒店'
  if (tourism === 'hostel') return '宿舍/旅舍'
  if (amenity === 'school') return '教学建筑'
  if (amenity === 'public_building') return '公共建筑'
  if (building === 'school') return '教学建筑'
  if (building === 'office') return '办公楼'
  if (building === 'dormitory') return '宿舍楼'
  if (building === 'commercial') return '商业建筑'
  if (building === 'hospital') return '医疗建筑'
  if (building === 'hotel') return '酒店'
  if (building === 'house' || building === 'residential') return '居住建筑'
  if (building === 'yes') return props.name ? '未细分建筑' : '泛化建筑'
  return building ? `建筑:${building}` : '未分类建筑'
}

function classifyFacility(props) {
  if (props.amenity === 'toilets') return '洗手间'
  if (props.amenity === 'restaurant') return '饭店'
  if (props.amenity === 'cafe') return '咖啡馆'
  if (props.amenity === 'fast_food') return '快餐'
  if (props.amenity === 'bank') return '银行'
  if (props.amenity === 'atm') return 'ATM'
  if (props.amenity === 'pharmacy') return '药房'
  if (props.amenity === 'post_office') return '邮局'
  if (props.amenity === 'police') return '安保/警务'
  if (props.amenity === 'bench') return '座椅'
  if (props.amenity === 'vending_machine') return '自动售卖'
  if (props.amenity === 'ice_cream') return '冰淇淋'
  if (props.amenity === 'public_building') return '公共服务'

  if (props.shop === 'supermarket') return '超市'
  if (props.shop === 'convenience') return '便利店'
  if (props.shop === 'gift') return '纪念品店'
  if (props.shop === 'books') return '书店'
  if (props.shop === 'clothes') return '服装店'
  if (props.shop === 'jewelry') return '首饰店'
  if (props.shop === 'mobile_phone') return '手机店'
  if (props.shop === 'mall') return '商场'
  if (props.shop === 'ticket') return '票务点'
  if (props.shop === 'variety_store') return '杂货店'

  if (props.tourism === 'museum') return '博物馆'
  if (props.tourism === 'attraction') return '景点'
  if (props.tourism === 'information') return '游客服务'
  if (props.tourism === 'viewpoint') return '观景点'
  if (props.tourism === 'artwork') return '艺术品'

  if (props.leisure === 'fitness_centre') return '健身'
  if (props.historic === 'palace') return '宫殿/景点'
  if (props.historic === 'temple') return '寺庙'
  if (props.historic === 'city_gate') return '城门'
  if (props.historic === 'memorial') return '纪念设施'

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
  if (highway === 'primary' || highway === 'secondary' || highway === 'tertiary' || highway === 'unclassified') return '外围连接路'
  return `road:${highway}`
}

function getPoint(feature) {
  if (!feature.geometry) return null
  if (feature.geometry.type === 'Point') return feature.geometry.coordinates
  if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
    const coords = feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates[0]
      : feature.geometry.coordinates[0][0]
    if (!coords || !coords.length) return null
    let lng = 0
    let lat = 0
    for (const pair of coords) {
      lng += pair[0]
      lat += pair[1]
    }
    return [lng / coords.length, lat / coords.length]
  }
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
    ignored: 0,
  }

  const bump = (bucket, key) => {
    bucket[key] = (bucket[key] || 0) + 1
  }

  for (const feature of geojson.features) {
    const props = feature.properties || {}
    const name = cleanName(props)

    if (props.building !== undefined) {
      if (isNoiseBuilding(props)) {
        summary.ignored += 1
      } else {
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

  const normalized = { buildings, facilities, roads, indoorPaths }
  fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2))
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))

  console.log('Wrote normalized data to', outputPath)
  console.log('Wrote normalized summary to', summaryPath)
  console.log('Summary:', JSON.stringify(summary, null, 2))
}

normalize()
