import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/lib/supabase'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  const { diary_id, title, content, location, force } = await request.json()
  if (!diary_id || !content) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

  // Check existing summary
  const supabase = createAdminClient()
  if (!force) {
    const { data: existing } = await supabase.from('diaries').select('ai_summary').eq('id', diary_id).single()
    if (existing?.ai_summary) return NextResponse.json({ summary: existing.ai_summary, cached: true })
  }

  const apiKey = process.env.OPENAI_API_KEY || ''
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.deepseek.com'
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const openai = new OpenAI({ apiKey, baseURL })

  try {
    const res = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{
        role: 'system',
        content: '你是旅行日记摘要专家。根据游记内容生成一段精炼的摘要（2-3句话），包含：去了哪里、做了什么、整体感受。不超过 100 字。',
      }, {
        role: 'user',
        content: `标题：${title || '无'}。地点：${location || '未知'}。\n\n游记内容：${content.slice(0, 2000)}`,
      }],
      temperature: 0.7,
      max_tokens: 200,
    })

    const summary = res.choices[0]?.message?.content?.trim() || ''
    if (!summary) return NextResponse.json({ error: 'Generation failed' }, { status: 500 })

    await supabase.from('diaries').update({ ai_summary: summary }).eq('id', diary_id)
    return NextResponse.json({ summary })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
