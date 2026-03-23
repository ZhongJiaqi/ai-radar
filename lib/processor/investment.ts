// ======================================================
// AI Radar - Investment event extractor
// Extracts structured investment/industry-chain signals from processed articles
// ======================================================

import { anthropic, HAIKU_MODEL } from '../claude'
import { createServiceClient } from '../supabase'
import {
  INVESTMENT_SECTOR_DETAIL_SLUGS,
  INVESTMENT_SECTOR_MAJOR,
  INVESTMENT_SECTOR_MAJOR_LABELS,
  resolveDetail,
  type InvestmentSectorMajor,
} from '../investment/taxonomy'

type InvestmentLLMResult = {
  company: string | null
  event_type: 'financing' | 'm&a' | 'capex' | 'ipo' | 'other' | null
  round: string | null
  amount_text: string | null
  currency: string | null
  investors: string[]
  sector_major: InvestmentSectorMajor
  sector_detail: string | null
  region: string | null
  is_public: boolean | null
  tickers: string[]
  summary_zh: string
  why_it_matters: string
}

const SYSTEM_PROMPT = `你是 AI Radar 的投融资与产业链分析师。
你的任务：从一条 AI 行业资讯中抽取“可投资的产业链信号”，并输出严格 JSON。
只输出 JSON，不要任何解释文字。`

function sanitize(text: string): string {
  return String(text || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\u2028|\u2029/g, ' ')
    .replace(/\0/g, '')
}

function buildUserPrompt(input: {
  title: string
  summary_zh: string
  why_it_matters: string
  tags: string[]
  source_name: string
  url: string
}): string {
  const majorList = INVESTMENT_SECTOR_MAJOR
    .map(m => `${m}（${INVESTMENT_SECTOR_MAJOR_LABELS[m]}）`)
    .join(' / ')
  const detailList = INVESTMENT_SECTOR_DETAIL_SLUGS.join(' / ')

  return `从下面这条资讯中抽取“投资事件”结构化信息。

输入：
- 标题: ${sanitize(input.title)}
- 摘要: ${sanitize(input.summary_zh)}
- 为什么重要: ${sanitize(input.why_it_matters)}
- 标签: ${(input.tags || []).slice(0, 10).join(', ')}
- 来源: ${sanitize(input.source_name)}
- 原文链接: ${sanitize(input.url)}

输出要求（严格 JSON，不加任何其他文字）：
{
  "company": "公司/标的（不确定填 null）",
  "event_type": "financing|m&a|capex|ipo|other（不确定填 null）",
  "round": "轮次/阶段（如A轮/战略投资/并购等，不确定填 null）",
  "amount_text": "金额原文（如“5000万人民币”“$20M”等，不确定填 null）",
  "currency": "币种（如CNY/USD，不确定填 null）",
  "investors": ["投资方/并购方（去重）"],
  "sector_major": "从以下选一个: ${majorList}",
  "sector_detail": "从以下选一个 slug（不确定填 null）: ${detailList}",
  "region": "主要发生地区/国家（不确定填 null）",
  "is_public": true/false/null（是否上市公司相关）,
  "tickers": ["如有明确股票代码则填，如NVDA；否则空数组"],
  "summary_zh": "用1句话概括这笔投资/事件本身",
  "why_it_matters": "用1句话说明对 AI 产业链/投资的意义"
}`
}

async function callWithRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries - 1) throw err
      const delay = Math.pow(2, i) * 1000
      console.warn(`[Investment] Retry ${i + 1}/${retries} after ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Unreachable')
}

export async function extractInvestmentEvent(input: {
  title: string
  summary_zh: string
  why_it_matters: string
  tags: string[]
  source_name: string
  url: string
}): Promise<InvestmentLLMResult> {
  const response = await callWithRetry(() =>
    anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          // Explicit content blocks for gateway compatibility.
          content: [{ type: 'text', text: buildUserPrompt(input) }],
        },
      ],
    })
  )

  const block = response.content[0]
  const text = block?.type === 'text' ? block.text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`)

  const parsed = JSON.parse(jsonMatch[0])

  const eventTypeRaw = String(parsed.event_type || '').trim()
  const eventType = (['financing', 'm&a', 'capex', 'ipo', 'other'] as const).includes(
    eventTypeRaw as any
  )
    ? (eventTypeRaw as InvestmentLLMResult['event_type'])
    : null

  const majorRaw = String(parsed.sector_major || '').trim()
  const major = (INVESTMENT_SECTOR_MAJOR.includes(majorRaw as any)
    ? majorRaw
    : 'compute_infra') as InvestmentSectorMajor

  const detailRaw = String(parsed.sector_detail || '').trim()
  const detail = INVESTMENT_SECTOR_DETAIL_SLUGS.includes(detailRaw) ? detailRaw : null
  const resolved = detail ? resolveDetail(detail) : null
  const finalMajor = resolved ? resolved.major : major

  const investors: string[] = Array.isArray(parsed.investors)
    ? parsed.investors.map((x: unknown) => String(x))
    : []
  const tickers: string[] = Array.isArray(parsed.tickers)
    ? parsed.tickers.map((x: unknown) => String(x))
    : []

  return {
    company: parsed.company ? String(parsed.company).slice(0, 120) : null,
    event_type: eventType,
    round: parsed.round ? String(parsed.round).slice(0, 80) : null,
    amount_text: parsed.amount_text ? String(parsed.amount_text).slice(0, 80) : null,
    currency: parsed.currency ? String(parsed.currency).slice(0, 20) : null,
    investors: Array.from(new Set(investors)).slice(0, 20),
    sector_major: finalMajor,
    sector_detail: detail,
    region: parsed.region ? String(parsed.region).slice(0, 40) : null,
    is_public: typeof parsed.is_public === 'boolean' ? parsed.is_public : null,
    tickers: Array.from(new Set(tickers)).slice(0, 10),
    summary_zh: String(parsed.summary_zh || '').slice(0, 300),
    why_it_matters: String(parsed.why_it_matters || '').slice(0, 300),
  }
}

export async function processInvestmentEvents(batchSize = 30, sinceDays = 30): Promise<{
  processed: number
  skipped: number
  failed: number
}> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await supabase
    .from('enriched_articles')
    .select('id, title, url, source_name, summary_zh, why_it_matters, tags, content_category, processed_at')
    .eq('content_category', 'funding_ma')
    .gte('processed_at', since)
    .order('processed_at', { ascending: false })
    .limit(batchSize)

  if (error) throw new Error(`Fetch enriched_articles failed: ${error.message}`)
  if (!candidates || candidates.length === 0) return { processed: 0, skipped: 0, failed: 0 }

  const ids = candidates.map(c => c.id)
  const { data: existing, error: existingError } = await supabase
    .from('investment_events')
    .select('article_id')
    .in('article_id', ids)

  if (existingError) throw new Error(`Fetch investment_events failed: ${existingError.message}`)
  const existingSet = new Set((existing || []).map(r => r.article_id))
  const toProcess = candidates.filter(c => !existingSet.has(c.id))

  let processed = 0
  let failed = 0
  let skipped = candidates.length - toProcess.length

  for (const c of toProcess) {
    try {
      const result = await extractInvestmentEvent({
        title: c.title,
        summary_zh: c.summary_zh,
        why_it_matters: c.why_it_matters,
        tags: Array.isArray(c.tags) ? c.tags : [],
        source_name: c.source_name,
        url: c.url,
      })

      const { error: upsertError } = await supabase
        .from('investment_events')
        .upsert({
          article_id: c.id,
          company: result.company,
          event_type: result.event_type,
          round: result.round,
          amount_text: result.amount_text,
          currency: result.currency,
          investors: result.investors,
          sector_major: result.sector_major,
          sector_detail: result.sector_detail,
          region: result.region,
          is_public: result.is_public,
          tickers: result.tickers,
          summary_zh: result.summary_zh,
          why_it_matters: result.why_it_matters,
          model_used: HAIKU_MODEL,
        }, { onConflict: 'article_id' })

      if (upsertError) throw new Error(`Upsert investment_events failed: ${upsertError.message}`)

      processed++
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error('[Investment] Failed for article', c.id, err)
      failed++
    }
  }

  return { processed, skipped, failed }
}
