import {
  HuffmanBuildResult,
  HuffmanCodeMapItem,
  HuffmanCompressionSegment,
  HuffmanCompressionSummary,
  HuffmanNodeKind,
  HuffmanSourceToken,
  HuffmanTreeNode,
  HuffmanTreeLayout,
  HuffmanTokenKind,
} from './huffman'

function makeId(prefix: string, n: number) {
  return `${prefix}-${n}`
}

export function buildHuffman(
  sourceText: string,
  tokenKind: HuffmanTokenKind = 'char'
): HuffmanBuildResult {
  const tokens: HuffmanSourceToken[] = []

  // Tokenize: support char, word, sentence
  let rawTokens: string[]
  if (tokenKind === 'char') {
    rawTokens = Array.from(sourceText)
  } else if (tokenKind === 'word') {
    rawTokens = sourceText.split(/\s+/).filter(Boolean)
  } else {
    // simple sentence splitter (avoid lookbehind / `u` flag for broader TS compatibility)
    const matches = sourceText.match(/[^。！？.!?]+[。！？.!?]?/g) || []
    rawTokens = matches.map((s) => s.trim()).filter(Boolean)
  }

  const freqMap = new Map<string, number>()
  for (const t of rawTokens) freqMap.set(t, (freqMap.get(t) || 0) + 1)

  let idx = 0
  for (const entry of Array.from(freqMap.entries())) {
    const value = entry[0]
    const frequency = entry[1]
    tokens.push({ id: makeId('t', idx++), value, frequency, weight: frequency })
  }

  // Edge: empty source
  if (tokens.length === 0) {
    const emptySummary: HuffmanCompressionSummary = {
      tokenKind,
      sourceText,
      rawBytes: Buffer.byteLength(sourceText, 'utf8'),
      compressedBits: 0,
      compressedBytes: 0,
      compressionRatio: 1,
      savingsRatio: 0,
      totalTokens: 0,
      uniqueTokens: 0,
    }
    return {
      summary: emptySummary,
      tokens: [],
      nodes: [],
      codeMap: [],
      segments: [],
      layout: null,
      encodedText: '',
      paddingBits: 0,
    }
  }

  // Build initial leaf nodes for priority queue
  type PQNode = { id: string; weight: number; tokenId: string | null; left: PQNode | null; right: PQNode | null }
  let pq: PQNode[] = tokens.map((t) => ({ id: t.id, weight: t.weight, tokenId: t.id, left: null, right: null }))

  // helper: sort pq ascending by weight
  const sortPQ = () => pq.sort((a, b) => a.weight - b.weight)
  sortPQ()

  let nextId = 0
  const internalNodes: PQNode[] = []

  while (pq.length > 1) {
    const a = pq.shift()!
    const b = pq.shift()!
    const parent: PQNode = { id: makeId('n', nextId++), weight: a.weight + b.weight, tokenId: null, left: a, right: b }
    pq.push(parent)
    sortPQ()
    internalNodes.push(parent)
  }

  const root = pq[0]

  // Traverse to build codes
  const nodes: HuffmanTreeNode[] = []

  function walk(n: PQNode | null, depth: number, code: string, parentId: string | null) {
    if (!n) return
    const isLeaf = n.tokenId !== null && n.left === null && n.right === null
    const kind: HuffmanNodeKind = isLeaf ? 'leaf' : parentId === null ? 'root' : 'internal'
    const nodeId = n.id
    const tokenId = n.tokenId
    const tokenValue = tokenId ? tokens.find((t) => t.id === tokenId)!.value : null

    const leftId = n.left ? n.left.id : null
    const rightId = n.right ? n.right.id : null

    nodes.push({
      id: nodeId,
      kind,
      weight: n.weight,
      depth,
      tokenId: tokenId,
      tokenValue: tokenValue,
      code,
      leftId,
      rightId,
      parentId,
    })

    if (n.left) walk(n.left, depth + 1, code + '0', nodeId)
    if (n.right) walk(n.right, depth + 1, code + '1', nodeId)
  }

  walk(root, 0, '', null)

  // Build code map for leaves
  const codeMap: HuffmanCodeMapItem[] = []
  for (const t of tokens) {
    const node = nodes.find((n) => n.tokenId === t.id)
    let code = node ? node.code : ''
    if (code === '') code = '0'
    codeMap.push({ tokenId: t.id, tokenValue: t.value, code, codeLength: code.length, frequency: t.frequency, weight: t.weight })
  }

  // Build segments and encoded text
  let encodedBits = ''
  const segments: HuffmanCompressionSegment[] = []
  let cumulative = 0
  for (let i = 0; i < rawTokens.length; i++) {
    const value = rawTokens[i]
    const t = tokens.find((x) => x.value === value)!
    const map = codeMap.find((c) => c.tokenId === t.id)!
    const bitLen = map.codeLength
    const before = cumulative
    encodedBits += map.code
    cumulative += bitLen
    segments.push({
      index: i,
      source: value,
      tokenId: t.id,
      tokenValue: t.value,
      code: map.code,
      bitLength: bitLen,
      cumulativeBitsBefore: before,
      cumulativeBitsAfter: cumulative,
    })
  }

  const paddingBits = (8 - (encodedBits.length % 8)) % 8
  const paddedEncoded = encodedBits + '0'.repeat(paddingBits)

  const compressedBits = paddedEncoded.length
  const compressedBytes = Math.ceil(compressedBits / 8)
  const rawBytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(sourceText).length : Buffer.byteLength(sourceText, 'utf8')

  const summary: HuffmanCompressionSummary = {
    tokenKind,
    sourceText,
    rawBytes,
    compressedBits,
    compressedBytes,
    compressionRatio: rawBytes === 0 ? 1 : compressedBytes / rawBytes,
    savingsRatio: rawBytes === 0 ? 0 : 1 - compressedBytes / rawBytes,
    totalTokens: rawTokens.length,
    uniqueTokens: tokens.length,
  }

  // Build a simple layout: inorder traversal assigns x positions, depth -> y
  const layoutNodes: { id: string; x: number; y: number; width: number; height: number }[] = []
  let xCounter = 0

  function inorder(n: PQNode | null, depth: number) {
    if (!n) return
    inorder(n.left, depth + 1)
    layoutNodes.push({ id: n.id, x: xCounter++, y: depth, width: 80, height: 40 })
    inorder(n.right, depth + 1)
  }

  inorder(root, 0)

  const layoutNodesMap = new Map(layoutNodes.map((ln) => [ln.id, ln]))

  const layout: HuffmanTreeLayout = {
    width: Math.max(300, xCounter * 100),
    height: Math.max(200, (Math.max(...nodes.map((n) => n.depth)) + 1) * 100),
    rootId: root.id,
    nodes: nodes.map((n) => {
      const ln = layoutNodesMap.get(n.id)
      return {
        id: n.id,
        label: n.tokenValue ?? n.id,
        kind: n.kind,
        depth: n.depth,
        weight: n.weight,
        code: n.code,
        x: ln ? ln.x * 100 + 50 : 0,
        y: ln ? ln.y * 100 + 50 : n.depth * 100,
        width: ln ? ln.width : 80,
        height: ln ? ln.height : 40,
        isLeaf: n.kind === 'leaf',
        tokenId: n.tokenId ?? null,
      }
    }),
    edges: nodes
      .filter((n) => n.leftId || n.rightId)
      .flatMap((n) => {
        const out: any[] = []
        if (n.leftId) {
          out.push({ id: `${n.id}->${n.leftId}`, fromId: n.id, toId: n.leftId, bit: '0' as const, weight: 0 })
        }
        if (n.rightId) {
          out.push({ id: `${n.id}->${n.rightId}`, fromId: n.id, toId: n.rightId, bit: '1' as const, weight: 0 })
        }
        return out
      }),
  }

  return {
    summary,
    tokens,
    nodes,
    codeMap,
    segments,
    layout,
    encodedText: paddedEncoded,
    paddingBits,
  }
}

export function decodeHuffman(encodedBits: string, codeMap: HuffmanCodeMapItem[]) {
  const map = new Map<string, string>()
  for (const item of codeMap) map.set(item.code, item.tokenValue)

  const results: string[] = []
  let buf = ''
  for (const b of encodedBits) {
    buf += b
    if (map.has(buf)) {
      results.push(map.get(buf)!)
      buf = ''
    }
  }
  return results.join('')
}

export default buildHuffman
