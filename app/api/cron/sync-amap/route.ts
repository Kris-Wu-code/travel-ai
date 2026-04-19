/**
 * GET /api/cron/sync-amap
 * Vercel Cron Job - 自动定期导入高德 POI 数据
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // 验证 Vercel Cron token
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Missing SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      )
    }

    // 使用当前请求域名，避免依赖 NEXT_PUBLIC_VERCEL_URL 配置
    const baseUrl = request.nextUrl.origin

    // 调用同步 API
    const response = await fetch(
      `${baseUrl}/api/sync-amap`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`Sync failed: ${data.error}`)
    }

    console.log(`[Cron] POI sync completed:`, {
      status: data.stats.scenesCount > 0 ? 'success' : 'no-scenes',
      scenes: data.stats.scenesCount,
      poi_written: data.stats.poiWrittenCount,
      duration: data.duration,
    })

    return NextResponse.json({
      success: true,
      message: 'POI sync completed via cron',
      stats: data.stats,
      duration: data.duration,
    })
  } catch (error: any) {
    console.error('[Cron] POI sync failed:', error?.message)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}
