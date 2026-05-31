'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import PageShell from '../components/page-shell'

type NoMatchKeyword = {
  keyword: string
  count: number
  category?: 'scene' | 'food' | 'unknown'
  exists?: boolean
}

type Scene = {
  id: string
  name: string
}

type Food = {
  id: string
  name: string
}

export default function ContentAuditPage() {
  const [days, setDays] = useState(30)
  const [keywords, setKeywords] = useState<NoMatchKeyword[]>([])
  const [existingScenes, setExistingScenes] = useState<Set<string>>(new Set())
  const [existingFoods, setExistingFoods] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState<'scene' | 'food' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (!supabase) {
        console.warn('Supabase not configured — skipping content audit load')
        setLoading(false)
        return
      }
      // 获取现有景区和美食
      const [scenesRes, foodsRes] = await Promise.all([
        (supabase as any).from('scenes').select('id, name').eq('status', 'active'),
        (supabase as any).from('food_items').select('id, name').eq('status', 'approved'),
      ])

      const sceneNames = new Set((scenesRes.data || []).map((s: any) => (s.name || '').toLowerCase()))
      const foodNames = new Set((foodsRes.data || []).map((f: any) => (f.name || '').toLowerCase()))

      setExistingScenes(sceneNames as Set<string>)
      setExistingFoods(foodNames as Set<string>)

      // 获取无匹配关键词
      const since = new Date()
      since.setDate(since.getDate() - days)
      const sinceIso = since.toISOString()

      const { data: searchEvents, error } = await supabase
        .from('search_events')
        .select('keyword, has_suggestion_match')
        .gte('created_at', sinceIso)
        .eq('has_suggestion_match', false)
        .order('created_at', { ascending: false })

      if (!error && searchEvents) {
        const kwMap = new Map<string, number>()
        for (const event of (searchEvents as any)) {
          const kw = (event as any).keyword?.trim() || ''
          if (kw && kw !== '__all__') {
            kwMap.set(kw, (kwMap.get(kw) ?? 0) + 1)
          }
        }

        const classified = Array.from(kwMap.entries())
          .map(([keyword, count]) => {
            const lower = keyword.toLowerCase()
            const inScenes = sceneNames.has(lower)
            const inFoods = foodNames.has(lower)

            let category: 'scene' | 'food' | 'unknown' = 'unknown'
            if (inScenes) category = 'scene'
            else if (inFoods) category = 'food'

            return {
              keyword,
              count,
              category,
              exists: inScenes || inFoods,
            }
          })
          .sort((a, b) => {
            // 先排序不存在的，然后按count排序
            if (a.exists !== b.exists) return a.exists ? 1 : -1
            return b.count - a.count
          })

        setKeywords(classified)
      }
    } catch (e) {
      console.error('加载失败:', e)
    }
    setLoading(false)
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  const handleAddItem = async () => {
    if (!newItemName.trim() || !newItemCategory) return

    setSubmitting(true)
    setMessage(null)

    try {
      if (!supabase) {
        setMessage({ type: 'error', text: '系统未配置 Supabase，无法添加' })
        setSubmitting(false)
        return
      }

      if (newItemCategory === 'scene') {
        const { error } = await (supabase as any).from('scenes').insert({
          name: newItemName.trim(),
          scene_type: 'scenic_spot',
          city: '未分类',
          description: `从搜索关键词自动识别：${newItemName}`,
          status: 'active',
        })
        if (error) throw error
        setMessage({ type: 'success', text: `✅ 景区"${newItemName}"已添加` })
      } else {
        const { error } = await (supabase as any).from('food_items').insert({
          name: newItemName.trim(),
          cuisine_type: '其他',
          canteen_name: '待补充',
          window_name: '待补充',
          price_range: '2-4',
          status: 'approved',
        })
        if (error) throw error
        setMessage({ type: 'success', text: `✅ 美食"${newItemName}"已添加` })
      }

      setNewItemName('')
      setNewItemCategory(null)
      setExpandedKeyword(null)
      setTimeout(() => load(), 500)
    } catch (e: any) {
      setMessage({ type: 'error', text: `❌ 添加失败: ${e?.message || '未知错误'}` })
    } finally {
      setSubmitting(false)
    }
  }

  const missingKeywords = useMemo(
    () => keywords.filter(k => !k.exists && k.category === 'unknown'),
    [keywords],
  )

  const existingButMissing = useMemo(
    () => keywords.filter(k => k.exists),
    [keywords],
  )

  return (
    <PageShell
      backHref="/sync-jobs"
      title="内容审计工具"
      subtitle="基于搜索无匹配数据，识别并快速补充缺失的景区和美食"
      contentMaxWidth="900px"
    >
      <div style={styles.wrap}>
        {/* 时间范围选择 */}
        <div style={styles.timeFilter}>
          <label style={styles.label}>时间范围：</label>
          {[7, 30, 90].map(d => (
            <button
              key={d}
              style={days === d ? styles.timeBtnActive : styles.timeBtn}
              onClick={() => setDays(d)}
            >
              {d}天
            </button>
          ))}
        </div>

        {/* 统计卡片 */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>总无匹配次数</div>
            <div style={styles.statValue}>{keywords.reduce((s, k) => s + k.count, 0)}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>独特关键词</div>
            <div style={styles.statValue}>{keywords.length}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>需要补充</div>
            <div style={{ ...styles.statValue, color: '#d97706' }}>
              {missingKeywords.length}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>已存在但被搜不到</div>
            <div style={{ ...styles.statValue, color: '#10b981' }}>
              {existingButMissing.length}
            </div>
          </div>
        </div>

        {/* 消息提示 */}
        {message && (
          <div
            style={{
              ...styles.messageBox,
              background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              borderColor: message.type === 'success' ? '#86efac' : '#fecaca',
              color: message.type === 'success' ? '#166534' : '#991b1b',
            }}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <div style={styles.empty}>加载中...</div>
        ) : missingKeywords.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={styles.emptyTitle}>完美！</div>
            <div style={styles.emptyDesc}>所有搜索都能找到内容，没有缺失的关键词。</div>
          </div>
        ) : (
          <div>
            {/* 需要补充的关键词 */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>🎯 需要补充的内容</div>
              <div style={styles.list}>
                {missingKeywords.map(kw => (
                  <div key={kw.keyword} style={styles.listItem}>
                    <div style={styles.itemHeader}>
                      <div style={styles.itemInfo}>
                        <div style={styles.keyword}>{kw.keyword}</div>
                        <div style={styles.count}>搜索 {kw.count} 次</div>
                      </div>
                      <button
                        style={styles.expandBtn}
                        onClick={() =>
                          setExpandedKeyword(expandedKeyword === kw.keyword ? null : kw.keyword)
                        }
                      >
                        {expandedKeyword === kw.keyword ? '收起' : '添加'}
                      </button>
                    </div>

                    {expandedKeyword === kw.keyword && (
                      <div style={styles.expandPanel}>
                        <div style={styles.panelLabel}>选择内容类型：</div>
                        <div style={styles.categoryButtons}>
                          <button
                            style={
                              newItemCategory === 'scene'
                                ? styles.categoryBtnActive
                                : styles.categoryBtn
                            }
                            onClick={() => setNewItemCategory('scene')}
                          >
                            🏔️ 景区
                          </button>
                          <button
                            style={
                              newItemCategory === 'food'
                                ? styles.categoryBtnActive
                                : styles.categoryBtn
                            }
                            onClick={() => setNewItemCategory('food')}
                          >
                            🍜 美食
                          </button>
                        </div>

                        <div style={styles.inputGroup}>
                          <input
                            type="text"
                            placeholder="确认或编辑内容名称"
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            onFocus={() => {
                              if (!newItemName) setNewItemName(kw.keyword)
                            }}
                            style={styles.input}
                          />
                          <button
                            onClick={handleAddItem}
                            disabled={submitting || !newItemName.trim() || !newItemCategory}
                            style={styles.submitBtn}
                          >
                            {submitting ? '提交中...' : '提交'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 已存在但无匹配的关键词 */}
            {existingButMissing.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>🔍 已存在但搜索不到的内容</div>
                <div style={styles.infoBox}>
                  <p>这些内容已在系统中，但用户搜索时没有匹配到。可能原因：</p>
                  <ul
                    style={{
                      marginTop: '8px',
                      paddingLeft: '20px',
                      fontSize: '13px',
                      lineHeight: '1.6',
                      color: '#6b7280',
                    }}
                  >
                    <li>用户使用了别名或简称</li>
                    <li>内容名称拼写有差异</li>
                    <li>全局搜索排序算法需要优化</li>
                  </ul>
                </div>
                <div style={styles.list}>
                  {existingButMissing.map(kw => (
                    <div key={kw.keyword} style={{ ...styles.listItem, opacity: 0.65 }}> 
                      <div style={styles.itemHeader}>
                        <div style={styles.itemInfo}>
                          <div style={styles.keyword}>{kw.keyword}</div>
                          <div style={styles.count}>搜索 {kw.count} 次</div>
                          <span
                            style={{
                              ...styles.badge,
                              background: kw.category === 'scene' ? '#f0fdf4' : '#fef3f2',
                              color: kw.category === 'scene' ? '#166534' : '#991b1b',
                            }}
                          >
                            {kw.category === 'scene' ? '景区' : '美食'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    width: '100%',
  },
  timeFilter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
  },
  timeBtn: {
    padding: '5px 10px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  timeBtnActive: {
    padding: '5px 10px',
    borderRadius: '6px',
    border: '1px solid #10b981',
    background: '#10b981',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
    marginBottom: '20px',
  },
  statCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '12px',
    background: '#f9fafb',
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
  },
  statValue: {
    marginTop: '6px',
    fontSize: '22px',
    fontWeight: 700,
    color: '#111827',
  },
  messageBox: {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid',
    marginBottom: '16px',
    fontSize: '13px',
    fontWeight: 500,
  },
  empty: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#6b7280',
  },
  emptyCard: {
    textAlign: 'center',
    padding: '60px 20px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
  },
  emptyDesc: {
    marginTop: '6px',
    fontSize: '13px',
    color: '#6b7280',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '12px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  listItem: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '12px',
    background: '#fff',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  keyword: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
  },
  count: {
    fontSize: '12px',
    color: '#6b7280',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 500,
  },
  expandBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  expandPanel: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e5e7eb',
  },
  panelLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '8px',
  },
  categoryButtons: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  categoryBtn: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  categoryBtnActive: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #4f46e5',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  inputGroup: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  submitBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    background: '#10b981',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  infoBox: {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    fontSize: '13px',
    color: '#374151',
    marginBottom: '12px',
  },
}
