/*
 * Scene navigation auto-plan regression check.
 *
 * This script performs static source assertions for the critical handoff chain:
 * places -> navigation query params -> scene shell initialDestination -> auto shortest path trigger.
 */

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function read(relPath) {
  const filePath = path.join(root, relPath)
  return fs.readFileSync(filePath, 'utf8')
}

function assertIncludes(content, expected, label) {
  const pass = content.includes(expected)
  return { label, pass, detail: expected }
}

function assertRegex(content, regex, label) {
  const pass = regex.test(content)
  return { label, pass, detail: regex.toString() }
}

function run() {
  const results = []

  const placesPanel = read(path.join('app', 'places', 'campus-map-panel.tsx'))
  const navigationPage = read(path.join('app', 'navigation', 'page.tsx'))
  const sceneShell = read(path.join('app', 'components', 'AmapNavigationShell.tsx'))

  // 1) places page must pass destination params to navigation
  results.push(assertIncludes(placesPanel, "params.set('mode', 'real-world')", 'places: sets navigation mode'))
  results.push(assertIncludes(placesPanel, "params.set('destName', selected.name)", 'places: passes destName'))
  results.push(assertIncludes(placesPanel, "params.set('destLng', String(selected.lng))", 'places: passes destLng'))
  results.push(assertIncludes(placesPanel, "params.set('destLat', String(selected.lat))", 'places: passes destLat'))

  // 2) navigation page must parse and forward initial destination to scene shell
  results.push(assertIncludes(navigationPage, 'const initialDestination =', 'navigation: computes initialDestination'))
  results.push(assertIncludes(navigationPage, 'initialDestination={initialDestination}', 'navigation: forwards initialDestination'))

  // 3) scene shell must accept initialDestination and map it to endId
  results.push(assertRegex(sceneShell, /function AmapNavigationShell\(\{\s*sceneId,\s*initialDestination\s*\}/, 'scene shell: accepts initialDestination prop'))
  results.push(assertIncludes(sceneShell, 'setEndId(resolvedDestination.id)', 'scene shell: applies injected destination as endId'))

  // 4) scene shell must auto trigger shortest path when destination exists
  results.push(assertIncludes(sceneShell, 'const autoPlanTriggerKeyRef = useRef(', 'scene shell: has auto-plan trigger guard'))
  results.push(assertIncludes(sceneShell, 'void handleShortestPath()', 'scene shell: auto calls shortest path'))
  results.push(assertRegex(sceneShell, /if \(!initialDestination \|\| !graphInfo\?\.pois\.length \|\| !endId \|\| routeLoading \|\| routeResult\)/, 'scene shell: auto-plan preconditions guard'))

  const failed = results.filter(item => !item.pass)

  console.log('--- scene auto-plan regression check ---')
  for (const item of results) {
    const mark = item.pass ? '[PASS]' : '[FAIL]'
    console.log(`${mark} ${item.label}`)
  }

  if (failed.length > 0) {
    console.log('\nFailure details:')
    for (const item of failed) {
      console.log(`- ${item.label}: missing ${item.detail}`)
    }
    process.exit(1)
  }

  console.log('\nAll critical scene auto-plan assertions passed.')
}

run()
