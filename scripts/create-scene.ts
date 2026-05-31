/**
 * 创建演示场景脚本
 * 快速在 Supabase 中创建一个测试场景
 */

import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { join } from 'path'

// 加载环境变量
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 环境变量缺失')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createScene() {
  console.log('\n' + '='.repeat(60))
  console.log('📍 创建演示场景')
  console.log('='.repeat(60) + '\n')

  try {
    // 检查场景是否已存在
    const { data: existing } = await supabase
      .from('scenes')
      .select('id')
      .eq('name', '示例校园')
      .single()

    if (existing) {
      console.log('ℹ️  场景已存在，跳过创建')
      console.log(`   场景 ID: ${existing.id}`)
      return existing.id
    }
  } catch {
    // 场景不存在，继续创建
  }

  const { data, error } = await supabase
    .from('scenes')
    .insert({
      name: '示例校园',
      scene_type: 'campus',
      city: '杭州',
      center_lat: 30.2741,
      center_lng: 120.1551,
      available_transports: ['walk', 'bike', 'ev'],
      status: 'active',
    })
    .select()

  if (error) {
    console.error('❌ 创建失败:', error.message)
    process.exit(1)
  }

  const sceneId = data[0].id
  console.log('✅ 场景创建成功！')
  console.log(`   场景 ID: ${sceneId}`)
  console.log(`   场景名: ${data[0].name}`)
  console.log(`   城市: ${data[0].city}`)
  console.log(`   类型: ${data[0].scene_type}\n`)

  return sceneId
}

createScene().catch(console.error)
