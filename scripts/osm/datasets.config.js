module.exports = {
  bupt_shahe: {
    label: '北京邮电大学沙河校区',
    fetchScript: 'scripts/osm/fetch_bupt_shahe_overpass.js',
    normalizeScript: 'scripts/osm/normalize_bupt_shahe.js',
    normalizedFile: 'scripts/data/bupt_shahe.normalized.json',
    coverageThreshold: 0.98,
  },
  forbidden_city: {
    label: '故宫',
    fetchScript: 'scripts/osm/fetch_forbidden_city_overpass.js',
    normalizeScript: 'scripts/osm/normalize_forbidden_city.js',
    normalizedFile: 'scripts/data/forbidden_city.normalized.json',
    coverageThreshold: 0.98,
  },
  badaling: {
    label: '八达岭长城',
    fetchScript: 'scripts/osm/fetch_badaling_overpass.js',
    normalizeScript: 'scripts/osm/normalize_badaling.js',
    normalizedFile: 'scripts/data/badaling.normalized.json',
    coverageThreshold: 0.95,
  },
}
