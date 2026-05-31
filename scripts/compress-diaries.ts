import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import buildHuffman from '../app/lib/algo/compress/buildHuffman'
config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const { data: diaries } = await supabase
    .from('diaries').select('id, content_raw')
    .is('compressed_size', null)
    .eq('compression_algo', 'none')
    .not('content_raw', 'is', null)

  if (!diaries?.length) { console.log('All diaries compressed.'); return }
  console.log(`Compressing ${diaries.length} diaries...`)

  let n = 0
  for (const d of diaries) {
    if (!d.content_raw || d.content_raw.length < 20) continue
    try {
      const build = buildHuffman(d.content_raw, 'char')
      const savings = 1 - build.summary.compressedBytes / build.summary.rawBytes
      if (savings <= 0.03) continue

      const bits = build.encodedText || ''
      const bytesLen = Math.ceil(bits.length / 8)
      const bytes = new Uint8Array(bytesLen)
      for (let i = 0; i < bytesLen; i++) {
        const byteBits = bits.slice(i * 8, i * 8 + 8).padEnd(8, '0')
        bytes[i] = parseInt(byteBits, 2)
      }
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const b64 = Buffer.from(binary, 'binary').toString('base64')

      await supabase.from('diaries').update({
        content_compressed: b64,
        compressed_size: build.summary.compressedBytes,
        raw_size: build.summary.rawBytes,
        compression_algo: 'huffman',
        huffman_layout: build.layout || null,
        huffman_code_map: build.codeMap || null,
      }).eq('id', d.id)

      n++
      if (n % 10 === 0) console.log(`  ${n}/${diaries.length}`)
    } catch {}
  }
  console.log(`Done: ${n} compressed`)
}

main()
