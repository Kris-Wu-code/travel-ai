import * as dotenv from 'dotenv'
import { AmapSync } from '../lib/amap-sync'

// 加载环境变量
dotenv.config({ path: '.env.local' })

// ─── 主函数 ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== 个性化旅游系统 — 高德 POI 数据导入 ===\n')

  // 验证必要的环境变量
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'AMAP_API_KEY',
  ]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing environment variable: ${envVar}`)
    }
  }

  try {
    const startTime = Date.now()

    // 创建 AmapSync 实例
    const sync = new AmapSync(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.AMAP_API_KEY!,
      {
        maxRetries: parseInt(process.env.AMAP_MAX_RETRIES || '3', 10),
        retryDelayMs: parseInt(process.env.AMAP_RETRY_DELAY_MS || '1000', 10),
      }
    )

    console.log('① 加载 active 场景...')
    const scenes = await sync.loadActiveScenes()
    console.log(`  ✓ 已加载 ${scenes.length} 个场景\n`)

    if (scenes.length === 0) {
      console.log('  [结束] 未找到可同步场景，请先在 scenes 表中配置 status=active 的场景')
      return
    }

    console.log('② 搜索并导入 POI 数据...\n')

    // 执行同步
    const stats = await sync.execute()
    const duration = Date.now() - startTime

    console.log(`\n=== 导入完成！共写入约 ${stats.poiWrittenCount} 条 POI ===`)
    console.log(`sync_jobs 统计: scenes=${stats.scenesCount}, requests=${stats.amapRequestCount}, rate_limited=${stats.amapRateLimitedCount}, retries=${stats.amapRetryCount}, poi_written=${stats.poiWrittenCount}, food_written=${stats.foodWrittenCount}`)
    console.log(`耗时: ${duration}ms`)
    console.log('请前往 Supabase Table Editor 查看 poi_items、food_items、sync_jobs 表\n')
  } catch (error: any) {
    console.error('导入失败:', error?.message || error)
    throw error
  }
}

main().catch(console.error)