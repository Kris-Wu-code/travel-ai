import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY || ''
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  if (!apiKey) return null
  return new OpenAI({ apiKey, baseURL })
}

const BUDGET_LABELS: Record<string, string> = {
  economy: '经济实惠（人均每天 150 元以下，青旅/快捷酒店+公共交通+小吃排档）',
  comfort: '舒适出行（人均每天 150-500 元，舒适酒店+网约车/地铁+中档餐厅）',
  luxury: '品质享受（人均每天 500 元以上，五星酒店+包车/专车+高级餐厅）',
}

const TRAVELER_LABELS: Record<string, string> = {
  solo: '独自旅行（一人自由行，灵活度高）',
  couple: '情侣出游（双人浪漫路线，适合拍照和氛围感场所）',
  family: '家庭出游（带老人小孩，需要轻松节奏、无障碍设施、亲子友好场所）',
  group: '朋友结伴（多人热闹，适合团建活动、网红打卡地和深夜去处）',
}

export type DayPlan = {
  day: number
  theme: string
  transport: string
  slots: {
    time: string
    activities: {
      name: string
      tag: 'spot' | 'food' | 'photo'
      desc: string
      duration: string
      price?: string
    }[]
  }[]
}

const RESPONSE_SCHEMA = `{
  "title": "3天北京之旅",
  "tips": "实用贴士内容...",
  "days": [
    {
      "day": 1,
      "theme": "皇城根下探秘",
      "transport": "🚇 地铁为主，单日通勤约 1 小时",
      "slots": [
        {
          "time": "上午",
          "activities": [
            { "name": "故宫博物院", "tag": "spot", "desc": "明清皇家宫殿，世界最大宫殿建筑群", "duration": "3-4 小时" },
            { "name": "景山公园", "tag": "photo", "desc": "俯瞰故宫全景的最佳机位", "duration": "1 小时" }
          ]
        },
        {
          "time": "中午",
          "activities": [
            { "name": "四季民福烤鸭店", "tag": "food", "desc": "故宫旁最火的烤鸭店，景观位可望角楼", "duration": "1 小时", "price": "人均 150 元" }
          ]
        }
      ]
    }
  ]
}`

export async function POST(request: NextRequest) {
  const openai = getOpenAIClient()
  if (!openai) {
    return NextResponse.json(
      { error: 'AI 服务未配置，请在 .env.local 中设置 OPENAI_API_KEY' },
      { status: 503 },
    )
  }

  let body: { destination: string; days: number; budget?: string; travelers?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const destination = (body.destination || '').trim()
  const days = Math.min(Math.max(Math.floor(body.days || 3), 1), 14)
  const budgetInfo = BUDGET_LABELS[body.budget || 'comfort'] || BUDGET_LABELS.comfort
  const travelerInfo = TRAVELER_LABELS[body.travelers || 'couple'] || TRAVELER_LABELS.couple

  if (!destination) {
    return NextResponse.json({ error: '请输入目的地' }, { status: 400 })
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `你是一个专业的旅行规划师。根据用户的目的地、天数、预算和出行人群，生成一份详细的旅行行程。

预算参考：${budgetInfo}
出行人群：${travelerInfo}

**重要：你必须返回纯 JSON，不要包含 Markdown 代码块标记。**

JSON 结构如下：
- title: 行程总标题，如"3天北京之旅"
- tips: 实用贴士（天气/穿搭/避坑建议，2-3 句话）
- days: 数组，每天包含：
  - day: 数字（1-N）
  - theme: 当天的主题概括，如"皇城根下探秘"
  - transport: 当天的交通方式和预估通勤时间
  - slots: 数组，每个时段包含：
    - time: "上午" / "中午" / "下午" / "晚上"
    - activities: 数组，每个活动包含：
      - name: 景点/餐厅/打卡地名称
      - tag: "spot"（景点）/ "food"（美食）/ "photo"（打卡点）
      - desc: 1-2 句简介
      - duration: 建议游览时间
      - price: 仅美食活动需要，如"人均 150 元"
- 每个时段推荐 1-2 个活动
- 每天必须有 4 个时段，至少包含 1 个 food 和 1 个 photo
- 行程节奏合理，景点间距离不远

参考格式：${RESPONSE_SCHEMA}`,
        },
        {
          role: 'user',
          content: `请为我去 ${destination} 规划一个 ${days} 天的旅行行程。直接返回 JSON，不要其他内容。`,
        },
      ],
      temperature: 0.8,
      max_tokens: 4000,
    })

    const raw = response.choices[0]?.message?.content || ''
    // Strip markdown fences if present
    const json = raw.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim()

    try {
      const parsed = JSON.parse(json)
      return NextResponse.json({ structured: true, markdown: raw, ...parsed })
    } catch {
      // Fallback: return as markdown if JSON parsing fails
      return NextResponse.json({ structured: false, markdown: raw })
    }
  } catch (error: any) {
    const message = error?.message || 'AI 行程生成失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
