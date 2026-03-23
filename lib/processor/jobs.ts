// ======================================================
// AI Radar - Jobs Processor (LLM)
// Turns raw job posts (HN/XHS/etc) into compact structured signals
// ======================================================

import { anthropic, HAIKU_MODEL } from '../claude'

type JobLLMResult = {
  summary_zh: string
  company: string | null
  role_title: string | null
  location: string | null
  remote: 'remote' | 'onsite' | 'hybrid' | null
  seniority: string | null
  ai_domain: string | null
  tags: string[]
  why_it_hot: string | null
}

const SYSTEM_PROMPT = `你是 AI Radar 的招聘信息分析师。
你的任务：从“岗位线索/招聘帖”中提取关键要点，方便 AI 从业者快速判断是否值得点开。
只输出严格 JSON，不要任何额外文字。`

function sanitize(text: string): string {
  return String(text || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\u2028|\u2029/g, ' ')
    .replace(/\0/g, '')
}

function buildPrompt(input: {
  title: string
  raw_text: string
  source_name: string
  url: string
  posted_at?: string | null
  metrics?: Record<string, unknown>
}): string {
  const metrics = input.metrics ? JSON.stringify(input.metrics).slice(0, 800) : '{}'
  return `分析下面这条“岗位线索/招聘帖”，输出结构化 JSON。

输入：
- 标题: ${sanitize(input.title)}
- 来源: ${sanitize(input.source_name)}
- 发布时间: ${sanitize(input.posted_at || '')}
- 链接: ${sanitize(input.url)}
- 互动/指标: ${metrics}
- 正文（可能包含多岗位）：${sanitize((input.raw_text || '').slice(0, 3500))}

输出（严格 JSON，不加其他文字）：
{
  "summary_zh": "1-2句中文摘要，写清楚岗位/方向/亮点",
  "company": "公司名（不确定填 null）",
  "role_title": "岗位名称（不确定填 null）",
  "location": "地点（不确定填 null）",
  "remote": "remote|onsite|hybrid|null",
  "seniority": "实习/初级/中级/高级/负责人等（不确定填 null）",
  "ai_domain": "LLM/CV/RL/多模态/数据/平台/产品/研究/其他（不确定填 null）",
  "tags": ["最多8个标签，偏技能栈/方向，如 LLM / Agent / RAG / 推荐 / 视觉 / PyTorch / Go / C++ 等"],
  "why_it_hot": "一句话说明为什么值得关注（不确定填 null）"
}`
}

async function callWithRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries - 1) throw err
      const delay = Math.pow(2, i) * 1000
      console.warn(`[Jobs] Retry ${i + 1}/${retries} after ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Unreachable')
}

export async function processJobPost(input: {
  title: string
  raw_text: string
  source_name: string
  url: string
  posted_at?: string | null
  metrics?: Record<string, unknown>
}): Promise<JobLLMResult> {
  const response = await callWithRetry(() =>
    anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          // Explicit content blocks for gateway compatibility.
          content: [{ type: 'text', text: buildPrompt(input) }],
        },
      ],
    })
  )

  const block = response.content[0]
  const text = block?.type === 'text' ? block.text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`)
  const parsed = JSON.parse(jsonMatch[0])

  const tags = Array.isArray(parsed.tags) ? parsed.tags.map(String) : []
  const remoteRaw = String(parsed.remote || '').toLowerCase().trim()
  const remote =
    remoteRaw === 'remote' || remoteRaw === 'onsite' || remoteRaw === 'hybrid'
      ? (remoteRaw as any)
      : null

  return {
    summary_zh: String(parsed.summary_zh || '').slice(0, 500),
    company: parsed.company ? String(parsed.company).slice(0, 120) : null,
    role_title: parsed.role_title ? String(parsed.role_title).slice(0, 120) : null,
    location: parsed.location ? String(parsed.location).slice(0, 120) : null,
    remote,
    seniority: parsed.seniority ? String(parsed.seniority).slice(0, 80) : null,
    ai_domain: parsed.ai_domain ? String(parsed.ai_domain).slice(0, 80) : null,
    tags: tags.slice(0, 8),
    why_it_hot: parsed.why_it_hot ? String(parsed.why_it_hot).slice(0, 200) : null,
  }
}

export function computeHotScore(input: {
  posted_at?: string | null
  metrics?: Record<string, unknown>
}): number {
  const m = input.metrics || {}

  const toNum = (v: unknown): number => {
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      const cleaned = v.replace(/,/g, '').trim()
      const n = Number(cleaned)
      return Number.isFinite(n) ? n : 0
    }
    return 0
  }

  const like = toNum((m as any).liked_count ?? (m as any).like ?? (m as any).likes)
  const comment = toNum((m as any).comment_count ?? (m as any).comments)
  const collect = toNum((m as any).collected_count ?? (m as any).collects ?? (m as any).favorites)
  const share = toNum((m as any).shared_count ?? (m as any).shares)

  const engagement = like + 3 * comment + 2 * collect + share

  let days = 2
  if (input.posted_at) {
    const t = Date.parse(input.posted_at)
    if (Number.isFinite(t)) {
      days = Math.max(0, (Date.now() - t) / (24 * 60 * 60 * 1000))
    }
  }
  const decay = Math.exp(-days / 3.5) // ~2.4d half-life
  const raw = engagement * decay

  const score = 1 + 9 * (raw / (raw + 200))
  const rounded = Math.round(score)
  return Math.max(1, Math.min(10, rounded))
}

