import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

function getChatClient() {
  const key = process.env.OPENAI_API_KEY || ''
  const base = process.env.OPENAI_BASE_URL || 'https://api.deepseek.com'
  if (!key) return null
  return new OpenAI({ apiKey: key, baseURL: base })
}

export async function POST(request: NextRequest) {
  const chatAi = getChatClient()
  if (!chatAi) {
    return NextResponse.json({ error: 'AI 服务未配置' }, { status: 503 })
  }

  let body: { title: string; content: string; location?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, content, location } = body
  if (!content || content.length < 20) {
    return NextResponse.json({ error: '日记内容太短' }, { status: 400 })
  }

  try {
    // Step 1: Generate image prompt via DeepSeek
    const promptRes = await chatAi.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{
        role: 'system',
        content: `你是 AI 绘画提示词专家。根据日记内容生成一段英文图片提示词。

要求：纯文本，不超过 150 字符，描述最有画面感的场景，包含光线色调`,
      }, {
        role: 'user',
        content: `日记：${title || ''}。${content.slice(0, 500)}。地点：${location || '未知'}`,
      }],
      temperature: 0.9,
      max_tokens: 150,
    })

    const imagePrompt = promptRes.choices[0]?.message?.content?.trim() || ''
    if (!imagePrompt) {
      return NextResponse.json({ error: '生成提示词失败' }, { status: 500 })
    }

    // Step 2: Generate image via SiliconFlow (free quota, China-friendly)
    let imageDataUrl: string | null = null
    let imageError: string | null = null

    const sfKey = process.env.IMAGE_API_KEY || ''
    if (sfKey) {
      try {
        const sfRes = await fetch('https://api.siliconflow.cn/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sfKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'Qwen/Qwen-Image',
            prompt: imagePrompt,
            image_size: '1664x928',
          }),
          signal: AbortSignal.timeout(30000),
        })

        const sfData = await sfRes.json()
        const imgUrl = sfData?.images?.[0]?.url

        if (imgUrl) {
          // Proxy the image so it works even if SiliconFlow URL expires
          try {
            const proxyRes = await fetch(imgUrl, { signal: AbortSignal.timeout(15000) })
            if (proxyRes.ok) {
              const buf = Buffer.from(await proxyRes.arrayBuffer())
              const ct = proxyRes.headers.get('content-type') || 'image/jpeg'
              imageDataUrl = `data:${ct};base64,${buf.toString('base64')}`
            }
          } catch {}
        } else {
          imageError = sfData?.message || '图片生成返回空'
        }
      } catch (err: any) {
        imageError = err?.message || 'Image generation failed'
      }
    } else {
      imageError = '未配置 IMAGE_API_KEY'
    }

    return NextResponse.json({
      success: true,
      imagePrompt,
      imageDataUrl,
      imageError,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || '生成失败' }, { status: 500 })
  }
}
