import buildHuffman, { decodeHuffman } from '../compress/buildHuffman'

describe('buildHuffman', () => {
  test('compresses and encodes simple text', () => {
    const text = 'aaaaabbbbcccdde'
    const res = buildHuffman(text, 'char')
    expect(res.summary.sourceText).toBe(text)
    expect(res.tokens.length).toBeGreaterThan(0)
    expect(res.encodedText.length).toBeGreaterThan(0)
    // encoded bits length should be less than raw bits for skewed distribution
    const rawBits = text.length * 8
    expect(res.summary.compressedBits).toBeLessThanOrEqual(rawBits)
  })

  test('decodeHuffman reconstructs sequence of tokens for char mode', () => {
    const text = 'abcabcabc'
    const res = buildHuffman(text, 'char')
    const decodedTokens = decodeHuffman(res.encodedText.slice(0, res.encodedText.length - res.paddingBits), res.codeMap)
    // decodeHuffman returns concatenated token values; for char tokenKind, should equal original
    expect(decodedTokens).toBe(text)
  })
})
