const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const ROOT = path.join(__dirname, '..', '..')
const ENV_PATH = path.join(ROOT, '.env.local')

function parseEnvFile(text) {
  const env = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    env[key] = value
  }
  return env
}

async function main() {
  const env = parseEnvFile(fs.readFileSync(ENV_PATH, 'utf8'))
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE env')
  const supabase = createClient(url, key)

  const { data, error } = await supabase.from('buildings').select('*').limit(5)
  if (error) throw error
  console.log('sample buildings:', JSON.stringify(data, null, 2))

  const { data: pdata, error: perror } = await supabase.from('places').select('*').limit(5)
  if (perror) throw perror
  console.log('sample places:', JSON.stringify(pdata, null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
