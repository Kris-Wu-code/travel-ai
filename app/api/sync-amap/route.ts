/**
 * POST /api/sync-amap
 * 触发高德 POI 数据导入，需要 Service Role Key 认证
 */

import { NextRequest, NextResponse } from 'next/server'
import { AmapSync } from '@/lib/amap-sync'

function getAmapServiceKey(): string {
  return (process.env.AMAP_SERVICE_KEY || process.env.AMAP_API_KEY || '').trim()
}

// 验证认证 header
function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!authHeader) return false

  // 支持两种格式：
  // 1. Bearer <SUPABASE_SERVICE_ROLE_KEY>
  // 2. X-Service-Role-Key header
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

  return token === serviceRoleKey
}

export async function POST(request: NextRequest) {
  // 检查认证
  if (!validateAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing authentication' },
      { status: 401 }
    )
  }

  // 检查环境变量
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'AMAP_SERVICE_KEY',
  ]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar] && !(envVar === 'AMAP_SERVICE_KEY' && getAmapServiceKey())) {
      return NextResponse.json(
        { error: `Missing environment variable: ${envVar}` },
        { status: 500 }
      )
    }
  }

  try {
    const startTime = Date.now()

    // 创建 AmapSync 实例
    const sync = new AmapSync(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      getAmapServiceKey(),
      {
        maxRetries: parseInt(process.env.AMAP_MAX_RETRIES || '3', 10),
        retryDelayMs: parseInt(process.env.AMAP_RETRY_DELAY_MS || '1000', 10),
      }
    )

    // 执行同步
    const stats = await sync.execute()
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      stats,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[/api/sync-amap] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

// 提供 GET 请求说明
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'POI 数据导入 API',
    endpoint: '/api/sync-amap',
    method: 'POST',
    auth: 'Bearer <SUPABASE_SERVICE_ROLE_KEY>',
    example: `
curl -X POST http://localhost:3000/api/sync-amap \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
    `,
    response: {
      success: true,
      stats: {
        scenesCount: 2,
        searchPlanCount: 13,
        amapRequestCount: 24,
        amapRateLimitedCount: 0,
        amapFailedCount: 0,
        amapRetryCount: 0,
        poiWrittenCount: 351,
        poiFailedCount: 0,
        foodWrittenCount: 181,
        foodFailedCount: 0,
      },
      duration: '15234ms',
      timestamp: '2026-04-19T10:30:00.000Z',
    },
  })
}
