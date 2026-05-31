'use client'

import { useEffect, useMemo, useState } from 'react'
import PageShell from '../components/page-shell'

type SearchAnalyticsData = {
  totalSearches: number
  uniqueKeywords: number
  peakHour: { hour: number; count: number }
  hourlyTrends: Array<{ hour: number; count: number }>
  cityPreferences: Array<{ city: string; count: number }>
  topKeywords: Array<{ keyword: string; count: number; noMatchCount: number; matchRate: number }>
  searchTodayCount: number
  searchThisWeekCount: number
  averageSearchesPerDay: number
}

export default function SearchAnalyticsPage() {
  const [data, setData] = useState<SearchAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/search-analytics')
      if (response.ok) {
        const payload = await response.json()
        setData(payload)
      }
    } catch (e) {
      console.error('Failed to load analytics:', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const maxHourlyCount = useMemo(
    () => Math.max(...(data?.hourlyTrends.map(h => h.count) || [1])),
    [data?.hourlyTrends],
  )

  const formatHourLabel = (hour: number) => {
    return hour.toString().padStart(2, '0') + ':00'
  }

  return (
    <PageShell
      backHref="/sync-jobs"
      title="搜索行为分析"
      subtitle="过去30天用户搜索趋势、地域偏好、热门关键词深度分析"
      actions={<button style={styles.refreshBtn} onClick={load}>刷新</button>}
      contentMaxWidth="1200px"
    >
      <div style={styles.wrap}>
        {loading ? (
          <div style={styles.empty}>加载中...</div>
        ) : !data ? (
          <div style={styles.empty}>加载失败，请重试</div>
        ) : (
          <>
            {/* 关键指标卡片 */}
            <div style={styles.kpiGrid}>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>总搜索次数</div>
                <div style={styles.kpiValue}>{data.totalSearches}</div>
                <div style={styles.kpiSub}>过去30天</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>日均搜索</div>
                <div style={styles.kpiValue}>{data.averageSearchesPerDay}</div>
                <div style={styles.kpiSub}>次/天</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>今日搜索</div>
                <div style={styles.kpiValue}>{data.searchTodayCount}</div>
                <div style={styles.kpiSub}>次</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>本周搜索</div>
                <div style={styles.kpiValue}>{data.searchThisWeekCount}</div>
                <div style={styles.kpiSub}>次</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>独特关键词</div>
                <div style={styles.kpiValue}>{data.uniqueKeywords}</div>
                <div style={styles.kpiSub}>个</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>峰值时点</div>
                <div style={styles.kpiValue}>{formatHourLabel(data.peakHour.hour)}</div>
                <div style={styles.kpiSub}>{data.peakHour.count}次搜索</div>
              </div>
            </div>

            {/* 小时趋势 */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>📊 每小时搜索热度（24小时趋势）</div>
              <div style={styles.chartWrap}>
                <div style={styles.hourlyChart}>
                  {data.hourlyTrends.map(point => (
                    <div key={point.hour} style={styles.hourColumn} title={`${formatHourLabel(point.hour)}: ${point.count}次`}>
                      <div
                        style={{
                          ...styles.hourBar,
                          height: `${Math.max(2, (point.count / maxHourlyCount) * 100)}%`,
                          background:
                            point.hour >= 8 && point.hour <= 22
                              ? 'linear-gradient(180deg, #10b981, #6ee7b7)'
                              : 'linear-gradient(180deg, #6b7280, #9ca3af)',
                        }}
                      />
                      <div style={styles.hourLabel}>{point.hour}h</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={styles.insight}>
                💡 洞察：搜索在 {formatHourLabel(data.peakHour.hour)} 达到峰值，共 {data.peakHour.count}
                次搜索
              </div>
            </div>

            {/* 地域偏好 */}
            <div style={styles.gridRow}>
              <div style={{ ...styles.section, flex: 1 }}>
                <div style={styles.sectionTitle}>🗺️ 地域搜索偏好</div>
                <div style={styles.cityList}>
                  {data.cityPreferences.length === 0 ? (
                    <div style={styles.empty}>暂无地域数据</div>
                  ) : (
                    data.cityPreferences.map((city, index) => {
                      const maxCount = data.cityPreferences[0]?.count || 1
                      const percentage = (city.count / maxCount) * 100
                      return (
                        <div key={city.city} style={styles.cityRow}>
                          <div style={styles.cityRank}>{index + 1}</div>
                          <div style={styles.cityName}>{city.city}</div>
                          <div style={styles.cityBar}>
                            <div
                              style={{
                                width: `${percentage}%`,
                                height: '20px',
                                background: 'linear-gradient(90deg, #10b981, #6ee7b7)',
                                borderRadius: '4px',
                                transition: 'width 0.3s',
                              }}
                            />
                          </div>
                          <div style={styles.cityCount}>{city.count}</div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* 关键词质量 */}
              <div style={{ ...styles.section, flex: 1 }}>
                <div style={styles.sectionTitle}>🎯 关键词匹配率 Top 5</div>
                <div style={styles.qualityList}>
                  {data.topKeywords.slice(0, 5).map((kw, index) => (
                    <div key={kw.keyword} style={styles.qualityRow}>
                      <div style={styles.qualityRank}>{index + 1}</div>
                      <div style={styles.qualityInfo}>
                        <div style={styles.qualityKeyword}>{kw.keyword}</div>
                        <div style={styles.qualityMeta}>
                          {kw.count}次 • {kw.matchRate}%匹配
                        </div>
                      </div>
                      <div
                        style={{
                          ...styles.qualityBadge,
                          background: kw.matchRate >= 80 ? '#d1fae5' : kw.matchRate >= 50 ? '#fef3c7' : '#fee2e2',
                          color:
                            kw.matchRate >= 80 ? '#065f46' : kw.matchRate >= 50 ? '#92400e' : '#991b1b',
                        }}
                      >
                        {kw.matchRate}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 热门关键词 */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>🔥 热门搜索关键词 Top 10</div>
              <div style={styles.keywordTable}>
                <div style={styles.tableHead}>
                  <div style={{ flex: 1 }}>关键词</div>
                  <div style={{ width: '60px', textAlign: 'center' }}>搜索次数</div>
                  <div style={{ width: '100px', textAlign: 'center' }}>无匹配</div>
                  <div style={{ width: '80px', textAlign: 'center' }}>匹配率</div>
                </div>
                {data.topKeywords.map((kw, index) => (
                  <div key={kw.keyword} style={styles.tableRow}>
                    <div style={{ flex: 1 }}>
                      <span style={styles.rankBadge}>{index + 1}</span>
                      <span>{kw.keyword}</span>
                    </div>
                    <div style={{ width: '60px', textAlign: 'center', fontWeight: 600 }}>
                      {kw.count}
                    </div>
                    <div style={{ width: '100px', textAlign: 'center', color: '#ef4444' }}>
                      {kw.noMatchCount}
                    </div>
                    <div
                      style={{
                        width: '80px',
                        textAlign: 'center',
                        fontWeight: 600,
                        color: kw.matchRate >= 80 ? '#10b981' : '#f97316',
                      }}
                    >
                      {kw.matchRate}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 数据驱动建议 */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>💡 数据驱动建议</div>
              <div style={styles.insightGrid}>
                <div style={styles.insightCard}>
                  <div style={styles.insightIcon}>⏰</div>
                  <div style={styles.insightTitle}>峰值运营</div>
                  <div style={styles.insightText}>
                    {data.peakHour.hour < 12
                      ? '用户在上午搜索最频繁，建议在此时段推送新景区'
                      : data.peakHour.hour < 18
                        ? '用户在下午搜索最频繁，下午是推荐新内容的最佳时间'
                        : '用户在晚间搜索最频繁，利用夜间时段吸引用户规划行程'}
                  </div>
                </div>

                <div style={styles.insightCard}>
                  <div style={styles.insightIcon}>🗺️</div>
                  <div style={styles.insightTitle}>地域聚焦</div>
                  <div style={styles.insightText}>
                    {data.cityPreferences.length > 0
                      ? `${data.cityPreferences[0].city} 是热搜城市，占总搜索的 ${Math.round((data.cityPreferences[0].count / data.totalSearches) * 100)}%，优先健全该地区内容`
                      : '用户搜索分布较为分散，需要补充更多城市内容'}
                  </div>
                </div>

                <div style={styles.insightCard}>
                  <div style={styles.insightIcon}>🎯</div>
                  <div style={styles.insightTitle}>内容补充</div>
                  <div style={styles.insightText}>
                    低匹配率的关键词（&lt;50%）代表内容空白，需要通过内容审计工具优先补充这些景区
                  </div>
                </div>

                <div style={styles.insightCard}>
                  <div style={styles.insightIcon}>📈</div>
                  <div style={styles.insightTitle}>增长机会</div>
                  <div style={styles.insightText}>
                    本周搜索比今日增长 {Math.round((data.searchThisWeekCount / Math.max(1, data.searchTodayCount)) - 1) * 100}%，平台活跃度
                    {data.averageSearchesPerDay > 10 ? '持续' : '需要'}提升
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    width: '100%',
  },
  refreshBtn: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid #4f46e5',
    background: '#4f46e5',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
    marginBottom: '24px',
  },
  kpiCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
  },
  kpiLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: 500,
  },
  kpiValue: {
    marginTop: '6px',
    fontSize: '28px',
    fontWeight: 700,
    color: '#111827',
  },
  kpiSub: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#9ca3af',
  },
  section: {
    marginBottom: '24px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '16px',
  },
  chartWrap: {
    overflow: 'auto',
    marginBottom: '16px',
  },
  hourlyChart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '4px',
    height: '180px',
    padding: '8px 0',
    minWidth: '600px',
  },
  hourColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  hourBar: {
    width: '100%',
    minHeight: '8px',
    borderRadius: '4px 4px 0 0',
    transition: 'all 0.3s',
  },
  hourLabel: {
    fontSize: '10px',
    color: '#9ca3af',
  },
  insight: {
    padding: '12px',
    borderRadius: '8px',
    background: '#f0fdf4',
    color: '#166534',
    fontSize: '13px',
    fontWeight: 500,
  },
  gridRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '24px',
  },
  cityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  cityRank: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: '#10b981',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityName: {
    width: '60px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#111827',
  },
  cityBar: {
    flex: 1,
    height: '20px',
    background: '#f3f4f6',
    borderRadius: '4px',
  },
  cityCount: {
    width: '40px',
    textAlign: 'right',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
  },
  qualityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  qualityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: '#f9fafb',
    borderRadius: '8px',
  },
  qualityRank: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: '#f3f4f6',
    fontSize: '12px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
  },
  qualityInfo: {
    flex: 1,
  },
  qualityKeyword: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#111827',
  },
  qualityMeta: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  qualityBadge: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
  },
  keywordTable: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  tableHead: {
    display: 'flex',
    background: '#f9fafb',
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    borderBottom: '1px solid #e5e7eb',
  },
  tableRow: {
    display: 'flex',
    padding: '12px 16px',
    fontSize: '13px',
    color: '#111827',
    borderBottom: '1px solid #f3f4f6',
    alignItems: 'center',
  },
  rankBadge: {
    display: 'inline-block',
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    background: '#10b981',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 700,
    textAlign: 'center',
    lineHeight: '20px',
    marginRight: '8px',
  },
  insightGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },
  insightCard: {
    padding: '14px',
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '8px',
  },
  insightIcon: {
    fontSize: '20px',
    marginBottom: '6px',
  },
  insightTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#166534',
    marginBottom: '4px',
  },
  insightText: {
    fontSize: '12px',
    color: '#065f46',
    lineHeight: '1.5',
  },
  empty: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#6b7280',
  },
}
