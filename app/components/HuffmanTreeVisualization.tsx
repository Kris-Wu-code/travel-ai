'use client'

import { useMemo, useState } from 'react'
import type {
  HuffmanTreeLayout,
  HuffmanTreeLayoutEdge,
  HuffmanTreeLayoutNode,
} from '../lib/algo/compress/huffman'

type HuffmanTreeVisualizationProps = {
  layout: HuffmanTreeLayout | null
  activeNodeId?: string | null
  activeTokenId?: string | null
  onNodeHover?: (nodeId: string | null) => void
  onNodeClick?: (nodeId: string) => void
  title?: string
  subtitle?: string
  emptyLabel?: string
  emptyDescription?: string
}

function nodeDisplayLabel(node: HuffmanTreeLayoutNode) {
  if (node.isLeaf) {
    const token = node.label || '未知 token'
    return token.length > 6 ? `${token.slice(0, 6)}…` : token
  }

  return `${node.weight}`
}

function nodeStrokeColor(node: HuffmanTreeLayoutNode, activeNodeId?: string | null, activeTokenId?: string | null) {
  if (node.id === activeNodeId || (node as any).tokenId === activeTokenId) {
    return node.isLeaf ? '#0f766e' : '#2563eb'
  }

  if (node.highlight === 'ancestor') return '#14b8a6'
  if (node.highlight === 'descendant') return '#3b82f6'
  if (node.highlight === 'match') return '#f59e0b'

  return node.isLeaf ? '#cbd5e1' : '#94a3b8'
}

function nodeFillColor(node: HuffmanTreeLayoutNode, activeNodeId?: string | null, activeTokenId?: string | null) {
  if (node.id === activeNodeId || (node as any).tokenId === activeTokenId) {
    return node.isLeaf ? '#ecfeff' : '#eff6ff'
  }

  if (node.highlight === 'ancestor') return '#f0fdfa'
  if (node.highlight === 'descendant') return '#eff6ff'
  if (node.highlight === 'match') return '#fff7ed'

  return node.isLeaf ? '#ffffff' : '#f8fafc'
}

function edgeStrokeColor(edge: HuffmanTreeLayoutEdge, activeNodeId?: string | null, activeTokenId?: string | null) {
  if (edge.highlighted) {
    return edge.bit === '0' ? '#0f766e' : '#1d4ed8'
  }

  if (activeNodeId || activeTokenId) {
    return '#cbd5e1'
  }

  return '#e2e8f0'
}

export function HuffmanTreeVisualization({
  layout,
  activeNodeId,
  activeTokenId,
  onNodeHover,
  onNodeClick,
  title = 'Huffman 压缩树',
  subtitle = '节点权重、路径编码和叶子 token 会在这里可视化。',
  emptyLabel = '暂无 Huffman 树',
  emptyDescription = '当前还没有构建压缩树。等 Huffman 结果接入后，这里会显示完整的树状结构。',
}: HuffmanTreeVisualizationProps) {
  const [showLegend, setShowLegend] = useState(true)

  const demoLayout = useMemo<HuffmanTreeLayout>(() => {
    if (layout) {
      return layout
    }

    return {
      width: 720,
      height: 260,
      rootId: 'demo-root',
      nodes: [
        {
          id: 'demo-root',
          label: 'root',
          kind: 'root',
          depth: 0,
          weight: 12,
          code: '',
          x: 300,
          y: 24,
          width: 120,
          height: 64,
          isLeaf: false,
        },
        {
          id: 'demo-left',
          label: 'A',
          kind: 'leaf',
          depth: 1,
          weight: 7,
          code: '0',
          x: 156,
          y: 150,
          width: 100,
          height: 64,
          isLeaf: true,
        },
        {
          id: 'demo-right',
          label: 'B',
          kind: 'leaf',
          depth: 1,
          weight: 5,
          code: '1',
          x: 420,
          y: 150,
          width: 100,
          height: 64,
          isLeaf: true,
        },
      ],
      edges: [
        { id: 'demo-edge-left', fromId: 'demo-root', toId: 'demo-left', bit: '0', weight: 7 },
        { id: 'demo-edge-right', fromId: 'demo-root', toId: 'demo-right', bit: '1', weight: 5 },
      ],
    }
  }, [layout])

  const activeNode = useMemo(
    () => layout?.nodes.find(node => node.id === activeNodeId) ?? null,
    [activeNodeId, layout?.nodes],
  )

  if (!layout) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</div>
          </div>
          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">待生成</span>
        </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          <div className="text-base font-semibold text-slate-900">{emptyLabel}</div>
          <div className="mt-2 leading-6">{emptyDescription}</div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">示意树</div>
          <div className="overflow-x-auto rounded-lg bg-slate-50 p-2">
            <svg width="720" height="260" viewBox="0 0 720 260" role="img" aria-label="Huffman 树示意图">
              {demoLayout.edges.map(edge => {
                const fromNode = demoLayout.nodes.find(node => node.id === edge.fromId)
                const toNode = demoLayout.nodes.find(node => node.id === edge.toId)
                if (!fromNode || !toNode) return null

                const x1 = fromNode.x + fromNode.width / 2
                const y1 = fromNode.y + fromNode.height / 2
                const x2 = toNode.x + toNode.width / 2
                const y2 = toNode.y + toNode.height / 2

                return (
                  <g key={edge.id}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 5" />
                    <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r="9" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.4" />
                    <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#475569">{edge.bit}</text>
                  </g>
                )
              })}
              {demoLayout.nodes.map(node => {
                const isRoot = node.kind === 'root'
                const isLeaf = node.kind === 'leaf'

                return (
                  <g key={node.id}>
                    <rect
                      x={node.x}
                      y={node.y}
                      rx="16"
                      ry="16"
                      width={node.width}
                      height={node.height}
                      fill={isLeaf ? '#ffffff' : '#eff6ff'}
                      stroke={isLeaf ? '#cbd5e1' : '#2563eb'}
                      strokeWidth="1.5"
                    />
                    <text x={node.x + node.width / 2} y={node.y + 23} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f172a">
                      {isRoot ? 'ROOT' : 'LEAF'}
                    </text>
                    <text x={node.x + node.width / 2} y={node.y + 42} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1f2937">
                      {node.label}
                    </text>
                    <text x={node.x + node.width / 2} y={node.y + node.height - 14} textAnchor="middle" fontSize="11" fill="#475569">
                      w={node.weight} · {node.code || 'root'}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>
    )
  }

  const nodeMap = new Map(demoLayout.nodes.map(node => [node.id, node]))
  const centerX = demoLayout.width / 2
  const svgWidth = Math.max(demoLayout.width, 760)
  const svgHeight = Math.max(demoLayout.height + 72, 360)

  // compute parent map and highlighted edge path for active node
  const parentMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of demoLayout.edges) {
      m.set(e.toId, e.fromId)
    }
    return m
  }, [demoLayout.edges])

  const highlightedEdgeIds = useMemo(() => {
    const set = new Set<string>()
    const activeIds: string[] = []
    if (activeNodeId) activeIds.push(activeNodeId)
    if (activeTokenId) {
      for (const n of demoLayout.nodes) {
        if ((n as any).tokenId && (n as any).tokenId === activeTokenId) {
          activeIds.push(n.id)
        }
      }
    }
    for (const startId of activeIds) {
      let cur = startId
      while (cur && parentMap.has(cur)) {
        const p = parentMap.get(cur)!
        const edgeId = `${p}->${cur}`
        set.add(edgeId)
        cur = p
      }
    }
    return set
  }, [activeNodeId, activeTokenId, parentMap, demoLayout.nodes])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          {activeNode ? (
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
              当前节点：{activeNode.label}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setShowLegend(previous => !previous)}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            {showLegend ? '隐藏图例' : '显示图例'}
          </button>
        </div>
      </div>

      {showLegend ? (
        <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            激活路径
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            内部节点
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            叶子节点
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            当前选中 token
          </span>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label="Huffman 树可视化">
          {demoLayout.edges.map(edge => {
            const fromNode = nodeMap.get(edge.fromId)
            const toNode = nodeMap.get(edge.toId)
            if (!fromNode || !toNode) return null

            const x1 = fromNode.x + fromNode.width / 2
            const y1 = fromNode.y + fromNode.height / 2
            const x2 = toNode.x + toNode.width / 2
            const y2 = toNode.y + toNode.height / 2
            const isHighlighted = highlightedEdgeIds.has(edge.id)
            const strokeColor = isHighlighted ? (edge.bit === '0' ? '#0f766e' : '#1d4ed8') : '#e2e8f0'

            return (
              <g key={edge.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth={isHighlighted ? 2.8 : 1.6}
                  strokeDasharray={isHighlighted ? '0' : '5 5'}
                  opacity={isHighlighted || !activeNodeId ? 1 : 0.75}
                />
                <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r="10" fill="#ffffff" stroke={strokeColor} strokeWidth="1.5" />
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill={strokeColor}
                >
                  {edge.bit}
                </text>
              </g>
            )
          })}

          {demoLayout.nodes.map(node => {
            const strokeColor = nodeStrokeColor(node, activeNodeId, activeTokenId)
            const fillColor = nodeFillColor(node, activeNodeId, activeTokenId)
            const isActive = node.id === activeNodeId || node.id === activeTokenId

            return (
              <g key={node.id}>
                          <rect
                  x={node.x}
                  y={node.y}
                  rx="16"
                  ry="16"
                  width={node.width}
                  height={node.height}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isActive ? 2.4 : 1.5}
                  filter="drop-shadow(0px 8px 20px rgba(15,23,42,0.06))"
                />
                          <rect
                            x={node.x}
                            y={node.y}
                            width={node.width}
                            height={node.height}
                            fill="transparent"
                            style={{ cursor: node.isLeaf ? 'pointer' : 'default' }}
                            onMouseEnter={() => onNodeHover && onNodeHover(node.id)}
                            onMouseLeave={() => onNodeHover && onNodeHover(null)}
                            onClick={() => onNodeClick && onNodeClick(node.id)}
                          />
                <text
                  x={node.x + node.width / 2}
                  y={node.y + 22}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#0f172a"
                >
                  {node.kind === 'root' ? 'ROOT' : node.isLeaf ? 'LEAF' : 'NODE'}
                </text>
                <text
                  x={node.x + node.width / 2}
                  y={node.y + 40}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill="#1f2937"
                >
                  {nodeDisplayLabel(node)}
                </text>
                <text
                  x={node.x + node.width / 2}
                  y={node.y + node.height - 16}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#475569"
                >
                  w={node.weight} · d={node.depth}
                </text>
              </g>
            )
          })}

          <line
            x1={centerX}
            y1="0"
            x2={centerX}
            y2={Math.min(layout.height, svgHeight)}
            stroke="#f1f5f9"
            strokeDasharray="4 8"
            strokeWidth="1"
          />
        </svg>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">节点统计</div>
          <div className="mt-2 text-sm text-slate-700">
            <div>总节点：{layout.nodes.length}</div>
            <div>叶子节点：{layout.nodes.filter(node => node.isLeaf).length}</div>
            <div>边数量：{layout.edges.length}</div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">当前高亮</div>
          <div className="mt-2 text-sm leading-6 text-slate-700">
            {activeNode ? (
              <>
                <span className="font-semibold text-slate-900">{activeNode.label}</span>
                <span className="ml-2 text-slate-500">(id: {activeNode.id})</span>
                <span className="block text-slate-500">编码前缀：{activeNode.code || 'root'}</span>
              </>
            ) : (
              '点击某个 token 后，可以在这里显示高亮节点和路径。'
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
