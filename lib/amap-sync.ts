/**
 * AMap POI 数据导入器 - 可被脚本和 API 端点共用
 */

import axios from 'axios'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type SceneType = 'scenic_spot' | 'campus'

export type SceneRecord = {
  id: string
  name: string
  scene_type: SceneType
  city: string
}

export type SearchPlan = {
  keywords: string
  types: string
  label: 'attraction' | 'restaurant' | 'supermarket' | 'library' | 'other'
}

export type SyncStats = {
  scenesCount: number
  searchPlanCount: number
  amapRequestCount: number
  amapRateLimitedCount: number
  amapFailedCount: number
  amapRetryCount: number
  poiWrittenCount: number
  poiFailedCount: number
  foodWrittenCount: number
  foodFailedCount: number
}

export type AmapSearchResult = {
  pois: any[]
  rateLimited: boolean
  failed: boolean
}

export type SyncJobParams = {
  status: 'success' | 'failed'
  startedAt: Date
  finishedAt: Date
  stats: SyncStats
  errorMessage?: string
}

// ─── AmapSync 类 ──────────────────────────────────────────────────
export class AmapSync {
  private supabase: SupabaseClient
  private amapKey: string
  private maxRetries: number
  private retryDelayMs: number
  private throttleMs: number

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string,
    amapKey: string,
    options?: {
      maxRetries?: number
      retryDelayMs?: number
      throttleMs?: number
    },
  ) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey)
    this.amapKey = amapKey
    this.maxRetries = options?.maxRetries ?? 3
    this.retryDelayMs = options?.retryDelayMs ?? 1000
    this.throttleMs = options?.throttleMs ?? 300
  }

  private uniqueByKeywords(items: SearchPlan[]) {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = `${item.keywords}|${item.types}|${item.label}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  buildSearchPlans(scene: SceneRecord): SearchPlan[] {
    const base = [
      { keywords: scene.name, types: '110000', label: 'attraction' as const },
      { keywords: `${scene.name}附近餐厅`, types: '050000', label: 'restaurant' as const },
      { keywords: `${scene.name}咖啡`, types: '050000', label: 'restaurant' as const },
      { keywords: `${scene.name}商店`, types: '060000', label: 'other' as const },
    ]

    if (scene.scene_type === 'campus') {
      return this.uniqueByKeywords([
        { keywords: `${scene.name}食堂`, types: '050000', label: 'restaurant' },
        { keywords: `${scene.name}超市`, types: '060900', label: 'supermarket' },
        { keywords: `${scene.name}图书馆`, types: '140000', label: 'library' },
        { keywords: scene.name, types: '141200', label: 'attraction' },
        ...base,
      ])
    }

    return this.uniqueByKeywords(base)
  }

  async loadActiveScenes(): Promise<SceneRecord[]> {
    const { data, error } = await this.supabase
      .from('scenes')
      .select('id, name, scene_type, city')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`加载场景失败: ${error.message}`)
    }

    return (data ?? []).filter(
      (scene): scene is SceneRecord =>
        typeof scene.id === 'string'
        && typeof scene.name === 'string'
        && (scene.scene_type === 'scenic_spot' || scene.scene_type === 'campus')
        && typeof scene.city === 'string'
        && scene.city.trim().length > 0,
    )
  }

  private mapCategory(amapType: string, label: string): string {
    if (label === 'attraction') return 'attraction'
    if (label === 'library') return 'library'
    if (label === 'supermarket') return 'supermarket'
    if (label === 'restaurant') return 'restaurant'
    if (amapType?.startsWith('05')) return 'restaurant'
    if (amapType?.startsWith('06')) return 'supermarket'
    if (amapType?.startsWith('11')) return 'attraction'
    if (amapType?.startsWith('14')) return 'library'
    return 'other'
  }

  async searchAmap(
    keywords: string,
    types: string,
    city: string,
    page = 1,
    retryCount = 0,
  ): Promise<AmapSearchResult & { retries: number }> {
    const url = 'https://restapi.amap.com/v3/place/text'
    try {
      const res = await axios.get(url, {
        params: {
          key: this.amapKey,
          keywords,
          types,
          city,
          offset: 25,
          page,
          output: 'json',
          extensions: 'base',
        },
        timeout: 8000,
      })

      if (res.data.status === '1' && res.data.pois) {
        return {
          pois: res.data.pois,
          rateLimited: false,
          failed: false,
          retries: retryCount,
        }
      }

      const info = String(res.data.info || '')
      const isRateLimited = info.includes('CUQPS_HAS_EXCEEDED_THE_LIMIT')

      // 限流时自动重试（指数退避）
      if (isRateLimited && retryCount < this.maxRetries) {
        const delay = this.retryDelayMs * Math.pow(2, retryCount)
        await new Promise(r => setTimeout(r, delay))
        return this.searchAmap(keywords, types, city, page, retryCount + 1)
      }

      return {
        pois: [],
        rateLimited: isRateLimited,
        failed: !isRateLimited,
        retries: retryCount,
      }
    } catch (err: any) {
      return {
        pois: [],
        rateLimited: false,
        failed: true,
        retries: retryCount,
      }
    }
  }

  private transformPoi(poi: any, scene: SceneRecord, label: string) {
    const [lng, lat] = (poi.location || '').split(',').map(Number)
    if (!lng || !lat) return null

    return {
      name: poi.name?.slice(0, 200) || '未知',
      category: this.mapCategory(poi.type, label),
      scene_type: scene.scene_type,
      scene_id: scene.id,
      city: scene.city,
      address: poi.address?.slice(0, 500) || '',
      latitude: lat,
      longitude: lng,
      price_level: 2,
      tags: poi.type ? [poi.typecode] : [],
      source: 'amap' as const,
      source_id: poi.id,
      status: 'approved' as const,
    }
  }

  private async insertFoodItem(poi: any, scene: SceneRecord): Promise<boolean> {
    const [lng, lat] = (poi.location || '').split(',').map(Number)
    if (!lng || !lat) {
      return false
    }

    const name: string = poi.name || ''
    let cuisine = '其他'
    if (name.includes('川') || name.includes('麻辣') || name.includes('火锅')) cuisine = '川菜'
    else if (name.includes('粤') || name.includes('广东')) cuisine = '粤菜'
    else if (name.includes('面') || name.includes('兰州') || name.includes('拉面')) cuisine = '清真'
    else if (name.includes('日') || name.includes('寿司') || name.includes('拉面')) cuisine = '日料'
    else if (name.includes('咖啡') || name.includes('coffee')) cuisine = '咖啡'
    else if (name.includes('甜') || name.includes('奶茶') || name.includes('冰')) cuisine = '甜品'
    else if (name.includes('食堂') || name.includes('快餐') || name.includes('米饭')) cuisine = '快餐'

    const foodPayload = {
      name: name.slice(0, 200),
      scene_id: scene.id,
      cuisine_type: cuisine,
      canteen_name: name.slice(0, 100),
      price_range: '10-50',
      avg_rating: 3.5 + Math.random() * 1.5,
      hot_score: Math.floor(Math.random() * 800) + 100,
      status: 'approved' as const,
    }

    const { error } = await this.supabase
      .from('food_items')
      .upsert(foodPayload, { onConflict: 'name,scene_id' })

    return !error
  }

  createInitialStats(): SyncStats {
    return {
      scenesCount: 0,
      searchPlanCount: 0,
      amapRequestCount: 0,
      amapRateLimitedCount: 0,
      amapFailedCount: 0,
      amapRetryCount: 0,
      poiWrittenCount: 0,
      poiFailedCount: 0,
      foodWrittenCount: 0,
      foodFailedCount: 0,
    }
  }

  async writeSyncJobLog(params: SyncJobParams): Promise<void> {
    const { status, startedAt, finishedAt, stats, errorMessage } = params
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime())

    const { error } = await this.supabase
      .from('sync_jobs')
      .insert({
        job_name: 'seed-amap',
        status,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: durationMs,
        scenes_count: stats.scenesCount,
        search_plan_count: stats.searchPlanCount,
        amap_request_count: stats.amapRequestCount,
        amap_rate_limited_count: stats.amapRateLimitedCount,
        amap_failed_count: stats.amapFailedCount,
        poi_written_count: stats.poiWrittenCount,
        poi_failed_count: stats.poiFailedCount,
        food_written_count: stats.foodWrittenCount,
        food_failed_count: stats.foodFailedCount,
        error_message: errorMessage || null,
      })

    if (error) {
      throw new Error(`sync_jobs 写入失败: ${error.message}`)
    }
  }

  async execute(): Promise<SyncStats> {
    const startedAt = new Date()
    const stats = this.createInitialStats()

    const scenes = await this.loadActiveScenes()
    stats.scenesCount = scenes.length

    if (scenes.length === 0) {
      const finishedAt = new Date()
      await this.writeSyncJobLog({
        status: 'success',
        startedAt,
        finishedAt,
        stats,
      })
      return stats
    }

    for (const scene of scenes) {
      const searches = this.buildSearchPlans(scene)
      stats.searchPlanCount += searches.length

      for (const search of searches) {
        // 搜索第1页和第2页，最多拿50条
        for (let page = 1; page <= 2; page++) {
          const searchResult = await this.searchAmap(search.keywords, search.types, scene.city, page)
          stats.amapRequestCount += 1
          stats.amapRetryCount += searchResult.retries
          if (searchResult.rateLimited) {
            stats.amapRateLimitedCount += 1
          }
          if (searchResult.failed) {
            stats.amapFailedCount += 1
          }

          const pois = searchResult.pois
          if (pois.length === 0) break

          const records = pois
            .map((poi: any) => this.transformPoi(poi, scene, search.label))
            .filter(Boolean)

          if (records.length === 0) continue

          // 批量写入 poi_items
          const { error } = await this.supabase
            .from('poi_items')
            .upsert(records, { onConflict: 'source,source_id', ignoreDuplicates: true })

          if (error) {
            stats.poiFailedCount += records.length
          } else {
            stats.poiWrittenCount += records.length

            // 餐厅类同步到 food_items
            const restaurants = pois.filter((p: any) =>
              p.type?.startsWith('05') || search.label === 'restaurant'
            )
            for (const poi of restaurants) {
              const ok = await this.insertFoodItem(poi, scene)
              if (ok) {
                stats.foodWrittenCount += 1
              } else {
                stats.foodFailedCount += 1
              }
            }
          }

          // 节流，避免请求太快被限流
          await new Promise(r => setTimeout(r, this.throttleMs))
        }
      }
    }

    const finishedAt = new Date()
    await this.writeSyncJobLog({
      status: 'success',
      startedAt,
      finishedAt,
      stats,
    })

    return stats
  }
}
