/*
Generate a manual review checklist (>= 70 POIs) from BUPT Shahe normalized data.

Output:
  scripts/data/bupt_shahe.poi_review_checklist.md

Run:
  node scripts/generate-bupt-shahe-poi-review.js
*/

const fs = require('fs')
const path = require('path')

const INPUT_PATH = path.join(__dirname, 'data', 'bupt_shahe.normalized.json')
const SUMMARY_PATH = path.join(__dirname, 'data', 'bupt_shahe.normalized.summary.json')
const OUTPUT_PATH = path.join(__dirname, 'data', 'bupt_shahe.poi_review_checklist.md')

const BUILDING_TARGET = 40
const FACILITY_TARGET = 30

function safeJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function pickPoint(item) {
  if (item && item.centroid && item.centroid.type === 'Point' && Array.isArray(item.centroid.coordinates)) {
    return item.centroid.coordinates
  }

  const geom = item && item.geom
  if (!geom || !geom.type || !Array.isArray(geom.coordinates)) return null
  const c = geom.coordinates

  if (geom.type === 'Point') return c
  if (geom.type === 'LineString') return c[0] || null
  if (geom.type === 'Polygon') return c[0] && c[0][0] ? c[0][0] : null
  if (geom.type === 'MultiPolygon') return c[0] && c[0][0] && c[0][0][0] ? c[0][0][0] : null
  if (geom.type === 'MultiLineString') return c[0] && c[0][0] ? c[0][0] : null

  return null
}

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function getName(item, fallbackPrefix, idx) {
  const raw = item && item.name ? String(item.name).trim() : ''
  return raw || `${fallbackPrefix}-${idx + 1}`
}

function groupedBy(items, keyFn) {
  const map = new Map()
  for (const item of items) {
    const key = keyFn(item)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }
  return map
}

function buildPool(items, keyFn) {
  const groups = groupedBy(items, keyFn)
  const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b))
  return { groups, keys }
}

function selectDiversified(items, total, keyFn) {
  const selected = []
  const used = new Set()
  const pool = buildPool(items, keyFn)

  // First pass: one from each category.
  for (const key of pool.keys) {
    const group = pool.groups.get(key)
    if (!group || !group.length) continue
    const candidate = group[0]
    selected.push(candidate)
    used.add(candidate)
    if (selected.length >= total) return selected
  }

  // Second pass: fill up proportionally by category order.
  let guard = 0
  while (selected.length < total && guard < items.length * 3) {
    guard += 1
    let appended = false

    for (const key of pool.keys) {
      const group = pool.groups.get(key) || []
      const next = group.find(item => !used.has(item))
      if (!next) continue
      selected.push(next)
      used.add(next)
      appended = true
      if (selected.length >= total) break
    }

    if (!appended) break
  }

  return selected
}

function formatCoord(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(6) : ''
}

function toChecklistLine(item, index, sourceType, kindField) {
  const name = getName(item, sourceType, index)
  const kind = item && item[kindField] ? String(item[kindField]) : '未分类'
  const coord = pickPoint(item)
  const lng = coord ? toNum(coord[0]) : null
  const lat = coord ? toNum(coord[1]) : null
  const osm = item && item.osm_id ? String(item.osm_id) : ''

  return [
    `- [ ] ${index + 1}. ${name}`,
    `  - 类型: ${kind}`,
    `  - 坐标: ${formatCoord(lng)}, ${formatCoord(lat)}`,
    `  - OSM: ${osm}`,
    '  - 核验项: 名称准确/类型准确/位置准确/是否对外可见',
  ].join('\n')
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Missing input file: ${INPUT_PATH}`)
  }

  const data = safeJson(INPUT_PATH)
  const summary = fs.existsSync(SUMMARY_PATH) ? safeJson(SUMMARY_PATH) : null

  const buildings = Array.isArray(data.buildings) ? data.buildings : []
  const facilities = Array.isArray(data.facilities) ? data.facilities : []
  const buildingsWithPoint = buildings.filter(item => pickPoint(item))
  const facilitiesWithPoint = facilities.filter(item => pickPoint(item))

  const selectedBuildings = selectDiversified(buildingsWithPoint, BUILDING_TARGET, item => item && item.kind ? String(item.kind) : '未分类建筑')
  const selectedFacilities = selectDiversified(facilitiesWithPoint, FACILITY_TARGET, item => item && item.category ? String(item.category) : '未分类设施')
  const totalTarget = 70
  const selectedSet = new Set([...selectedBuildings, ...selectedFacilities])
  const remainingNeeded = Math.max(0, totalTarget - selectedBuildings.length - selectedFacilities.length)
  const supplemental = remainingNeeded > 0
    ? selectDiversified(
        buildingsWithPoint.filter(item => !selectedSet.has(item)),
        remainingNeeded,
        item => item && item.kind ? String(item.kind) : '未分类建筑',
      )
    : []

  const lines = []
  lines.push('# 北邮沙河 POI 手动走查清单')
  lines.push('')
  lines.push(`- 建筑抽样: ${selectedBuildings.length}`)
  lines.push(`- 设施抽样: ${selectedFacilities.length}`)
  lines.push(`- 补充抽样: ${supplemental.length}`)
  lines.push(`- 总抽样: ${selectedBuildings.length + selectedFacilities.length + supplemental.length}`)
  lines.push(`- 可用建筑候选: ${buildingsWithPoint.length}`)
  lines.push(`- 可用设施候选: ${facilitiesWithPoint.length}`)
  if (summary && summary.facilities && typeof summary.facilities.distinctKinds === 'number') {
    lines.push(`- 设施类型总数(归一化): ${summary.facilities.distinctKinds}`)
  }
  lines.push('')
  lines.push('## 建筑走查 (40)')
  lines.push('')

  selectedBuildings.forEach((item, idx) => {
    lines.push(toChecklistLine(item, idx, 'building', 'kind'))
  })

  lines.push('')
  lines.push('## 服务设施走查 (30)')
  lines.push('')

  selectedFacilities.forEach((item, idx) => {
    lines.push(toChecklistLine(item, idx, 'facility', 'category'))
  })

  if (supplemental.length > 0) {
    lines.push('')
    lines.push(`## 补充走查 (${supplemental.length})`)
    lines.push('')

    supplemental.forEach((item, idx) => {
      lines.push(toChecklistLine(item, idx, 'supplement', 'kind'))
    })
  }

  lines.push('')
  lines.push('## 结论模板')
  lines.push('')
  lines.push('- [ ] 已完成70个POI现场核验')
  lines.push('- [ ] 名称问题数量: ___')
  lines.push('- [ ] 类型问题数量: ___')
  lines.push('- [ ] 坐标问题数量: ___')
  lines.push('- [ ] 需要人工补录数量: ___')

  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'))

  const result = {
    output: OUTPUT_PATH,
    selectedBuildings: selectedBuildings.length,
    selectedFacilities: selectedFacilities.length,
    supplemental: supplemental.length,
    total: selectedBuildings.length + selectedFacilities.length + supplemental.length,
    reviewTotal: selectedBuildings.length + selectedFacilities.length + supplemental.length,
    buildingsWithPoint: buildingsWithPoint.length,
    facilitiesWithPoint: facilitiesWithPoint.length,
  }

  console.log(JSON.stringify(result, null, 2))
}

main()
