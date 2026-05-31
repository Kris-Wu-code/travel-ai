export type HuffmanTokenKind = 'char' | 'word' | 'sentence'

export type HuffmanNodeKind = 'leaf' | 'internal' | 'root'

export interface HuffmanSourceToken {
  id: string
  value: string
  frequency: number
  weight: number
}

export interface HuffmanTreeNode {
  id: string
  kind: HuffmanNodeKind
  weight: number
  depth: number
  tokenId: string | null
  tokenValue: string | null
  code: string
  leftId: string | null
  rightId: string | null
  parentId: string | null
}

export interface HuffmanCodeMapItem {
  tokenId: string
  tokenValue: string
  code: string
  codeLength: number
  frequency: number
  weight: number
}

export interface HuffmanCompressionSegment {
  index: number
  source: string
  tokenId: string
  tokenValue: string
  code: string
  bitLength: number
  cumulativeBitsBefore: number
  cumulativeBitsAfter: number
}

export interface HuffmanCompressionSummary {
  tokenKind: HuffmanTokenKind
  sourceText: string
  rawBytes: number
  compressedBits: number
  compressedBytes: number
  compressionRatio: number
  savingsRatio: number
  totalTokens: number
  uniqueTokens: number
}

export interface HuffmanTreeLayoutNode {
  id: string
  label: string
  kind: HuffmanNodeKind
  depth: number
  weight: number
  code: string
  x: number
  y: number
  width: number
  height: number
  isLeaf: boolean
  tokenId?: string | null
  highlight?: 'active' | 'ancestor' | 'descendant' | 'match'
}

export interface HuffmanTreeLayoutEdge {
  id: string
  fromId: string
  toId: string
  bit: '0' | '1'
  weight: number
  highlighted?: boolean
}

export interface HuffmanTreeLayout {
  width: number
  height: number
  rootId: string
  nodes: HuffmanTreeLayoutNode[]
  edges: HuffmanTreeLayoutEdge[]
}

export interface HuffmanBuildResult {
  summary: HuffmanCompressionSummary
  tokens: HuffmanSourceToken[]
  nodes: HuffmanTreeNode[]
  codeMap: HuffmanCodeMapItem[]
  segments: HuffmanCompressionSegment[]
  layout: HuffmanTreeLayout | null
  encodedText: string
  paddingBits: number
}

export interface HuffmanComparisonRow {
  index: number
  originalText: string
  tokenValue: string
  code: string
  tokenCount: number
  rawBytesBefore: number
  rawBytesAfter: number
  compressedBitsBefore: number
  compressedBitsAfter: number
}

export interface HuffmanComparisonTable {
  sourceText: string
  rows: HuffmanComparisonRow[]
  totalRawBytes: number
  totalCompressedBits: number
  totalCompressedBytes: number
  compressionRatio: number
  savingsRatio: number
}
