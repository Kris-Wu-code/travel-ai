'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PageShell from '../components/page-shell'

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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/sync-jobs', { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok) {
        setError(payload?.error || '加载失败')
        setJobs([])
        setLoading(false)
        return
      }

      setJobs(Array.isArray(payload?.jobs) ? payload.jobs : [])
      setSummary(payload?.summary || {
        total: 0,
        successCount: 0,
        failedCount: 0,
        successRate: 0,
        avgDurationMs: 0,
        lastSuccessAt: null,
      })
      setLoading(false)
    } catch (e: any) {
      setError(e?.message || '加载失败')
      setJobs([])
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const recentFailure = useMemo(() => jobs.find(job => job.status === 'failed') ?? null, [jobs])

  return (
    <PageShell
      backHref="/dashboard"
      title="导入监控面板"
      subtitle="查看最近 20 次 AMap 同步任务的执行健康度"
      actions={<button style={styles.refreshBtn} onClick={load}>刷新</button>}
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

        {recentFailure ? (
          <div style={styles.warnCard}>
            <div style={styles.warnTitle}>最近失败任务</div>
            <div style={styles.warnText}>时间：{formatDateTime(recentFailure.created_at)}</div>
            <div style={styles.warnText}>原因：{recentFailure.error_message || '无错误信息'}</div>
          </div>
        ) : null}

        {loading ? (
          <div style={styles.empty}>正在加载同步数据...</div>
        ) : error ? (
          <div style={styles.empty}>加载失败：{error}</div>
        ) : jobs.length === 0 ? (
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
                {jobs.map(job => (
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
