/*
Validate BUPT Shahe normalized data against project thresholds.

Thresholds:
- buildings >= 20
- facility kinds >= 10
- facilities total >= 50

Run:
  node scripts/check-bupt-shahe-targets.js
*/

const fs = require('fs')
const path = require('path')

const summaryPath = path.join(__dirname, 'data', 'bupt_shahe.normalized.summary.json')

function main() {
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Missing summary file: ${summaryPath}. Run normalize first.`)
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
  const buildingCount = Number(summary.buildings && summary.buildings.total ? summary.buildings.total : 0)
  const facilityCount = Number(summary.facilities && summary.facilities.total ? summary.facilities.total : 0)
  const facilityKinds = Number(summary.facilities && summary.facilities.distinctKinds ? summary.facilities.distinctKinds : 0)

  const checks = {
    buildingAtLeast20: buildingCount >= 20,
    facilityKindsAtLeast10: facilityKinds >= 10,
    facilitiesAtLeast50: facilityCount >= 50,
  }

  const out = {
    buildingCount,
    facilityCount,
    facilityKinds,
    checks,
    pass: Object.values(checks).every(Boolean),
  }

  console.log(JSON.stringify(out, null, 2))

  if (!out.pass) process.exit(2)
}

main()
