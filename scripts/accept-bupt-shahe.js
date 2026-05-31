/*
Automated acceptance check for BUPT Shahe campus dataset.

Checks:
- buildings >= 20
- facility kinds >= 10
- facilities >= 50
- review checklist contains 70 POIs (40 buildings + 30 facilities)
- review checklist has no obvious missing coordinates

Run:
  node scripts/accept-bupt-shahe.js
*/

const fs = require('fs')
const path = require('path')

const SUMMARY_PATH = path.join(__dirname, 'data', 'bupt_shahe.normalized.summary.json')
const REVIEW_PATH = path.join(__dirname, 'data', 'bupt_shahe.poi_review_checklist.md')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function countChecklistEntries(markdown, heading) {
  const sectionStart = markdown.indexOf(heading)
  if (sectionStart === -1) return 0

  const after = markdown.slice(sectionStart)
  const nextHeadingMatch = after.match(/\n##\s+/)
  const section = nextHeadingMatch ? after.slice(0, nextHeadingMatch.index) : after
  return (section.match(/^- \[ \]/gm) || []).length
}

function countMissingCoordinates(markdown) {
  const lines = markdown.split(/\r?\n/)
  let count = 0
  for (const line of lines) {
    if (line.startsWith('  - 坐标:')) {
      const value = line.replace('  - 坐标:', '').trim()
      if (!value || value === ',') count += 1
      if (/^,\s*$/.test(value)) count += 1
      if (/^\s*,\s*$/.test(value)) count += 1
      if (value.includes('undefined') || value.includes('null')) count += 1
    }
  }
  return count
}

function countAllChecklistEntries(markdown) {
  const section = markdown.split('## 结论模板')[0]
  return (section.match(/^- \[ \]/gm) || []).length
}

function main() {
  if (!fs.existsSync(SUMMARY_PATH)) {
    throw new Error(`Missing summary file: ${SUMMARY_PATH}. Run normalize first.`)
  }
  if (!fs.existsSync(REVIEW_PATH)) {
    throw new Error(`Missing review checklist: ${REVIEW_PATH}. Run review script first.`)
  }

  const summary = readJson(SUMMARY_PATH)
  const review = fs.readFileSync(REVIEW_PATH, 'utf8')

  const buildingCount = Number(summary.buildings?.total || 0)
  const facilityCount = Number(summary.facilities?.total || 0)
  const facilityKinds = Number(summary.facilities?.distinctKinds || 0)
  const reviewBuildings = countChecklistEntries(review, '## 建筑走查 (40)')
  const reviewFacilities = countChecklistEntries(review, '## 服务设施走查 (30)')
  const reviewTotal = countAllChecklistEntries(review)
  const missingCoordinates = countMissingCoordinates(review)

  const checks = {
    buildingsAtLeast20: buildingCount >= 20,
    facilityKindsAtLeast10: facilityKinds >= 10,
    facilitiesAtLeast50: facilityCount >= 50,
    reviewBuildingsIs40: reviewBuildings === 40,
    reviewTotalIs70: reviewTotal === 70,
    reviewHasNoMissingCoordinates: missingCoordinates === 0,
  }

  const result = {
    buildingCount,
    facilityCount,
    facilityKinds,
    reviewBuildings,
    reviewFacilities,
    reviewTotal,
    missingCoordinates,
    checks,
    pass: Object.values(checks).every(Boolean),
  }

  console.log(JSON.stringify(result, null, 2))

  if (!result.pass) {
    process.exit(2)
  }
}

main()
