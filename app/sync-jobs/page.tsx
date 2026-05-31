'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import PageShell from '../components/page-shell'
import { loadSearchAnalyticsSummary, type SearchAnalyticsSummary } from '../lib/search-analytics'

type SyncJobRow = {
  id: string
  job_name: string
  status: 'success' | 'failed'
  started_at: string
  finished_at: string
  duration_ms: number
  scenes_count: number
  amap_request_count: number
  amap_rate_limited_count: number
  amap_failed_count: number
  poi_written_count: number
  food_written_count: number
  error_message: string | null
  created_at: string
}

type Summary = {
  total: number
  successCount: number
  failedCount: number
  successRate: number
  avgDurationMs: number
  lastSuccessAt: string | null
}

type TrendPoint = {
  date: string
  success: number
  failed: number
  poiWritten: number
}

type SearchAnalyticsApiPayload = {
  totalSearches: number
  noMatchSearches: number
  noMatchRate: number
  topKeywords: Array<{ keyword: string; count: number }>
  topNoMatchKeywords: Array<{ keyword: string; count: number }>
} | null

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(durationMs: number) {
  const seconds = Math.round((durationMs || 0) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remain = seconds % 60
  return `${minutes}m ${remain}s`
}

export default function SyncJobsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<SyncJobRow[]>([])
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    successCount: 0,
    failedCount: 0,
    successRate: 0,
    avgDurationMs: 0,
    lastSuccessAt: null,
  })
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all')
  const [searchSummary, setSearchSummary] = useState<SearchAnalyticsSummary>({
    totalSearches: 0,
    noMatchSearches: 0,
    noMatchRate: 0,
    topKeywords: [],
  })
  const [topNoMatchKeywords, setTopNoMatchKeywords] = useState<Array<{ keyword: string; count: number }>>([])
  const [searchSummarySource, setSearchSummarySource] = useState<'server' | 'local'>('local')
  const [searchDaysFilter, setSearchDaysFilter] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams({ days: String(searchDaysFilter) })
      const response = await fetch(`/api/sync-jobs?${queryParams}`, { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok) {
        setError(payload?.error || '加载失败')
        setJobs([])
        setLoading(false)
        return
      }

      setJobs(Array.isArray(payload?.jobs) ? payload.jobs : [])
      setTrends(Array.isArray(payload?.trends) ? payload.trends : [])
      setSummary(payload?.summary || {
        total: 0,
        successCount: 0,
        failedCount: 0,
        successRate: 0,
        avgDurationMs: 0,
        lastSuccessAt: null,
      })

      const serverSearch = (payload?.searchAnalytics ?? null) as SearchAnalyticsApiPayload
      if (serverSearch) {
        setSearchSummary({
          totalSearches: serverSearch.totalSearches,
          noMatchSearches: serverSearch.noMatchSearches,
          noMatchRate: serverSearch.noMatchRate,
          topKeywords: serverSearch.topKeywords,
        })
        setTopNoMatchKeywords(serverSearch.topNoMatchKeywords)
        setSearchSummarySource('server')
      } else {
        const localSummary = loadSearchAnalyticsSummary()
        setSearchSummary(localSummary)
        setTopNoMatchKeywords([])
        setSearchSummarySource('local')
      }
      setLoading(false)
    } catch (e: any) {
      setError(e?.message || '加载失败')
      setJobs([])
      setTrends([])
      const localSummary = loadSearchAnalyticsSummary()
      setSearchSummary(localSummary)
      setTopNoMatchKeywords([])
      setSearchSummarySource('local')
      setLoading(false)
    }
  }, [searchDaysFilter])

  useEffect(() => {
    load()
  }, [load, searchDaysFilter])

  const recentFailure = useMemo(() => jobs.find(job => job.status === 'failed') ?? null, [jobs])
  const filteredJobs = useMemo(() => {
    if (statusFilter === 'all') return jobs
    return jobs.filter(job => job.status === statusFilter)
  }, [jobs, statusFilter])

  const maxTrendValue = useMemo(() => {
    const values = trends.map(item => Math.max(item.success + item.failed, 1))
    return values.length > 0 ? Math.max(...values) : 1
  }, [trends])

  return (
    <PageShell
      backHref="/"
      title="导入监控面板"
      subtitle="查看最近 20 次 AMap 同步任务的执行健康度"
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={styles.refreshBtn} onClick={load}>
            刷新
          </button>
          <Link href="/search-analytics" style={styles.analyticsBtn}>
            搜索分析 →
          </Link>
          <Link href="/content-audit" style={styles.auditBtn}>
            内容审计 →
          </Link>
        </div>
      }
      contentMaxWidth="1100px"
    >
      <div style={styles.wrap}>
        <div style={styles.kpiGrid}>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>总任务数</div>
            <div style={styles.kpiValue}>{summary.total}</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>成功率</div>
            <div style={styles.kpiValue}>{summary.successRate}%</div>
            <div style={styles.kpiSub}>成功 {summary.successCount} / 失败 {summary.failedCount}</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>平均耗时</div>
            <div style={styles.kpiValue}>{formatDuration(summary.avgDurationMs)}</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>最近成功时间</div>
            <div style={styles.kpiSub}>{formatDateTime(summary.lastSuccessAt)}</div>
          </div>
        </div>

        <div style={styles.searchCard}>
          <div style={styles.searchTitle}>搜索行为统计（{searchSummarySource === 'server' ? `全站近${searchDaysFilter}天` : '本设备本地'}）</div>
          <div style={styles.searchTimeFilter}>
            <button style={searchDaysFilter === 1 ? styles.timeFilterBtnActive : styles.timeFilterBtn} onClick={() => setSearchDaysFilter(1)}>今日</button>
            <button style={searchDaysFilter === 7 ? styles.timeFilterBtnActive : styles.timeFilterBtn} onClick={() => setSearchDaysFilter(7)}>7天</button>
            <button style={searchDaysFilter === 30 ? styles.timeFilterBtnActive : styles.timeFilterBtn} onClick={() => setSearchDaysFilter(30)}>30天</button>
          </div>
          <div style={styles.searchKpiRow}>
            <div style={styles.searchKpiItem}>
              <div style={styles.searchKpiLabel}>总搜索次数</div>
              <div style={styles.searchKpiValue}>{searchSummary.totalSearches}</div>
            </div>
            <div style={styles.searchKpiItem}>
              <div style={styles.searchKpiLabel}>无匹配次数</div>
              <div style={styles.searchKpiValue}>{searchSummary.noMatchSearches}</div>
            </div>
            <div style={styles.searchKpiItem}>
              <div style={styles.searchKpiLabel}>无匹配占比</div>
              <div style={styles.searchKpiValue}>{searchSummary.noMatchRate}%</div>
            </div>
          </div>

          {searchSummary.topKeywords.length > 0 ? (
            <div style={styles.keywordWrap}>
              {searchSummary.topKeywords.map(item => (
                <div key={item.keyword} style={styles.keywordTag}>
                  {item.keyword === '__all__' ? '查看全部景区' : item.keyword} · {item.count}
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.searchHint}>还没有搜索数据，先在首页或任意页面顶部试一次搜索。</div>
          )}

          {topNoMatchKeywords.length > 0 ? (
            <div style={styles.noMatchWrap}>
              <div style={styles.noMatchTitle}>无匹配关键词 Top</div>
              <div style={styles.keywordWrap}>
                {topNoMatchKeywords.map(item => (
                  <div key={`nomatch-${item.keyword}`} style={styles.keywordTagWarn}>
                    {item.keyword === '__all__' ? '查看全部景区' : item.keyword} · {item.count}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {recentFailure ? (
          <div style={styles.warnCard}>
            <div style={styles.warnTitle}>最近失败任务</div>
            <div style={styles.warnText}>时间：{formatDateTime(recentFailure.created_at)}</div>
            <div style={styles.warnText}>原因：{recentFailure.error_message || '无错误信息'}</div>
          </div>
        ) : null}

        {trends.length > 0 ? (
          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>近 7 天任务趋势</div>
            <div style={styles.chartWrap}>
              {trends.map(point => {
                const total = point.success + point.failed
                const barHeight = Math.max(8, Math.round((total / maxTrendValue) * 100))
                return (
                  <div key={point.date} style={styles.chartCol}>
                    <div style={{ ...styles.chartBar, height: `${barHeight}px` }} title={`成功 ${point.success} / 失败 ${point.failed}`}>
                      <div style={{ ...styles.chartSuccess, flex: point.success }} />
                      <div style={{ ...styles.chartFailed, flex: point.failed }} />
                    </div>
                    <div style={styles.chartDate}>{point.date.slice(5)}</div>
                    <div style={styles.chartMeta}>POI {point.poiWritten}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        <div style={styles.filterRow}>
          <button
            style={statusFilter === 'all' ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => setStatusFilter('all')}
          >
            全部
          </button>
          <button
            style={statusFilter === 'success' ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => setStatusFilter('success')}
          >
            仅成功
          </button>
          <button
            style={statusFilter === 'failed' ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => setStatusFilter('failed')}
          >
            仅失败
          </button>
          <span style={styles.filterHint}>当前显示 {filteredJobs.length} 条</span>
        </div>

        {loading ? (
          <div style={styles.empty}>正在加载同步数据...</div>
        ) : error ? (
          <div style={styles.empty}>加载失败：{error}</div>
        ) : filteredJobs.length === 0 ? (
          <div style={styles.empty}>暂无同步任务记录</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>时间</th>
                  <th style={styles.th}>状态</th>
                  <th style={styles.th}>耗时</th>
                  <th style={styles.th}>请求</th>
                  <th style={styles.th}>失败</th>
                  <th style={styles.th}>限流</th>
                  <th style={styles.th}>POI写入</th>
                  <th style={styles.th}>Food写入</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map(job => (
                  <tr key={job.id}>
                    <td style={styles.td}>{formatDateTime(job.created_at)}</td>
                    <td style={styles.td}>
                      <span style={job.status === 'success' ? styles.okBadge : styles.failBadge}>
                        {job.status === 'success' ? '成功' : '失败'}
                      </span>
                    </td>
                    <td style={styles.td}>{formatDuration(job.duration_ms)}</td>
                    <td style={styles.td}>{job.amap_request_count}</td>
                    <td style={styles.td}>{job.amap_failed_count}</td>
                    <td style={styles.td}>{job.amap_rate_limited_count}</td>
                    <td style={styles.td}>{job.poi_written_count}</td>
                    <td style={styles.td}>{job.food_written_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'grid',
    gap: '16px',
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
  auditBtn: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid #10b981',
    background: '#10b981',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-block',
  },
  analyticsBtn: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid #8b5cf6',
    background: '#8b5cf6',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-block',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  kpiCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
  },
  kpiLabel: {
    fontSize: '12px',
    color: '#6b7280',
  },
  kpiValue: {
    marginTop: '6px',
    fontSize: '22px',
    fontWeight: 700,
    color: '#111827',
  },
  kpiSub: {
    marginTop: '6px',
    fontSize: '13px',
    color: '#4b5563',
  },
  warnCard: {
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: '12px',
    padding: '12px 14px',
  },
  warnTitle: {
    fontSize: '13px',
    color: '#9a3412',
    fontWeight: 700,
    marginBottom: '6px',
  },
  warnText: {
    fontSize: '13px',
    color: '#9a3412',
    lineHeight: 1.6,
  },
  chartCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
  },
  chartTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '12px',
  },
  chartWrap: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
    overflowX: 'auto',
  },
  chartCol: {
    minWidth: '66px',
    textAlign: 'center',
  },
  chartBar: {
    width: '24px',
    margin: '0 auto 6px',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '6px',
    overflow: 'hidden',
    background: '#f3f4f6',
  },
  chartSuccess: {
    background: '#22c55e',
    minHeight: '2px',
  },
  chartFailed: {
    background: '#ef4444',
    minHeight: '2px',
  },
  chartDate: {
    fontSize: '11px',
    color: '#6b7280',
  },
  chartMeta: {
    fontSize: '11px',
    color: '#374151',
    marginTop: '2px',
  },
  searchCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
  },
  searchTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '10px',
  },
  searchTimeFilter: {
    display: 'flex',
    gap: '6px',
    marginBottom: '12px',
  },
  timeFilterBtn: {
    padding: '5px 10px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  timeFilterBtnActive: {
    padding: '5px 10px',
    borderRadius: '6px',
    border: '1px solid #10b981',
    background: '#10b981',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  searchKpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px',
  },
  searchKpiItem: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '10px',
    background: '#f9fafb',
  },
  searchKpiLabel: {
    fontSize: '12px',
    color: '#6b7280',
  },
  searchKpiValue: {
    marginTop: '5px',
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
  },
  keywordWrap: {
    marginTop: '10px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  keywordTag: {
    border: '1px solid #dbe2f1',
    borderRadius: '999px',
    padding: '4px 10px',
    fontSize: '12px',
    color: '#374151',
    background: '#fff',
  },
  searchHint: {
    marginTop: '10px',
    fontSize: '12px',
    color: '#6b7280',
  },
  noMatchWrap: {
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: '1px solid #f3f4f6',
  },
  noMatchTitle: {
    fontSize: '12px',
    color: '#9a3412',
    fontWeight: 700,
    marginBottom: '8px',
  },
  keywordTagWarn: {
    border: '1px solid #fed7aa',
    borderRadius: '999px',
    padding: '4px 10px',
    fontSize: '12px',
    color: '#9a3412',
    background: '#fff7ed',
  },
  filterRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '6px 12px',
    borderRadius: '999px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  filterBtnActive: {
    padding: '6px 12px',
    borderRadius: '999px',
    border: '1px solid #4f46e5',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  filterHint: {
    marginLeft: '4px',
    fontSize: '12px',
    color: '#6b7280',
  },
  tableWrap: {
    overflowX: 'auto',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '850px',
  },
  th: {
    textAlign: 'left',
    fontSize: '12px',
    color: '#6b7280',
    padding: '10px 12px',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
    fontWeight: 600,
  },
  td: {
    fontSize: '13px',
    color: '#111827',
    padding: '10px 12px',
    borderBottom: '1px solid #f3f4f6',
  },
  okBadge: {
    display: 'inline-block',
    borderRadius: '999px',
    padding: '2px 8px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '12px',
    fontWeight: 700,
  },
  failBadge: {
    display: 'inline-block',
    borderRadius: '999px',
    padding: '2px 8px',
    background: '#fee2e2',
    color: '#991b1b',
    fontSize: '12px',
    fontWeight: 700,
  },
  empty: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '18px',
    textAlign: 'center',
    color: '#6b7280',
  },
}
