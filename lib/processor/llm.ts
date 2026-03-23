// ======================================================
// AI Radar - LLM Processor (Anthropic Claude API)
// ======================================================

import { anthropic, HAIKU_MODEL } from '../claude'
import { createServiceClient } from '../supabase'
import { SOURCE_CONFIGS } from '../crawlers/sources'
import { CATEGORY_LABELS } from '../i18n/categories'
import { CONTENT_CATEGORIES } from '../types'
import type { LLMResult, ContentCategory } from '../types'

const SYSTEM_PROMPT = `你是 AI Radar 的内容分析师，专注于全球 AI 行业动态。
你的任务是分析 AI 相关文章，为中国 AI 从业者（产品经理、开发者、创业者）提取关键信息。
输出必须是严格的 JSON 格式，不得包含任何额外文字。`

// Build "slug (中文名)" list for the LLM prompt
const CATEGORY_PROMPT_LIST = CONTENT_CATEGORIES
  .map(slug => `${slug} (${CATEGORY_LABELS[slug].zh})`)
  .join(' / ')

function sanitizeContent(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars
    .replace(/\\/g, '\\\\')  // escape backslashes
    .replace(/\u2028/g, ' ') // line separator
    .replace(/\u2029/g, ' ') // paragraph separator
    .replace(/\0/g, '')      // null bytes
}

function buildUserPrompt(title: string, content: string, sourceCategory: string): string {
  return `分析以下 AI 资讯，返回 JSON：

标题: ${sanitizeContent(title)}
来源类型: ${sourceCategory}
内容摘要: ${sanitizeContent(content.slice(0, 2000))}

返回格式（严格 JSON，不加任何其他文字）：
{
  "summary_zh": "2-3句话的中文摘要，说清楚是什么、有什么变化",
  "category": "从以下选一个英文 slug: ${CATEGORY_PROMPT_LIST}",
  "tags": ["标签1", "标签2", "标签3"],
  "importance_score": 数字1-10（10=行业级重大事件，1=一般信息），
  "why_it_matters": "一句话说清楚对 AI 从业者的核心影响或机会"
}`
}

async function callWithRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries - 1) throw err
      const delay = Math.pow(2, i) * 1000
      console.warn(`[LLM] Retry ${i + 1}/${retries} after ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Unreachable')
}

export async function processArticle(
  title: string,
  content: string,
  sourceCategory: string
): Promise<LLMResult> {
  const response = await callWithRetry(() =>
    anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 512,
      messages: [
        // Use explicit content blocks for maximum gateway compatibility.
        {
          role: 'user',
          content: [{ type: 'text', text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(title, content, sourceCategory)}` }],
        },
      ],
    })
  )

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`)
  }

  const parsed = JSON.parse(jsonMatch[0])

  // Validate and sanitize
  const category = CONTENT_CATEGORIES.includes(parsed.category)
    ? parsed.category as ContentCategory
    : 'industry_news'

  const score = Math.max(1, Math.min(10, Math.round(Number(parsed.importance_score) || 5)))

  return {
    summary_zh: String(parsed.summary_zh || '').slice(0, 500),
    category,
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.slice(0, 8).map(String)
      : [],
    importance_score: score,
    why_it_matters: String(parsed.why_it_matters || '').slice(0, 300),
  }
}

// ---- Batch processor ----

export async function processUnprocessedArticles(batchSize = 20): Promise<{
  processed: number
  failed: number
}> {
  const supabase = createServiceClient()

  // Log job start
  const { data: job } = await supabase
    .from('job_runs')
    .insert({ job_type: 'process', status: 'running' })
    .select('id')
    .single()
  const jobId = job?.id

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, content, source_slug, process_attempts')
    .eq('is_processed', false)
    .is('skip_reason', null)
    .lt('process_attempts', 3)
    .order('published_at', { ascending: false })
    .limit(batchSize)

  if (error) throw new Error(`Fetch error: ${error.message}`)
  if (!articles || articles.length === 0) return { processed: 0, failed: 0 }

  console.log(`[Processor] Processing ${articles.length} articles...`)

  let processed = 0
  let failed = 0

  for (const article of articles) {
    try {
      const src = SOURCE_CONFIGS.find(s => s.slug === article.source_slug)
      const sourceCategory = src?.category || 'media'
      const result = await processArticle(
        article.title,
        article.content || article.title,
        sourceCategory
      )

      const { error: insertError } = await supabase
        .from('processed_articles')
        .insert({
          article_id: article.id,
          summary_zh: result.summary_zh,
          category: result.category,
          tags: result.tags,
          importance_score: result.importance_score,
          why_it_matters: result.why_it_matters,
          model_used: HAIKU_MODEL,
        })

      if (insertError) {
        console.error(`[Processor] Insert error for ${article.id}:`, insertError)
        failed++
        continue
      }

      await supabase
        .from('articles')
        .update({ is_processed: true })
        .eq('id', article.id)

      processed++
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`[Processor] Failed for article ${article.id}:`, err)
      const attempts = (article.process_attempts || 0) + 1
      const update: Record<string, unknown> = {
        process_attempts: attempts,
        last_error: String(err).slice(0, 500),
      }
      if (attempts >= 3) {
        update.skip_reason = `Failed after ${attempts} attempts: ${String(err).slice(0, 200)}`
      }
      await supabase.from('articles').update(update).eq('id', article.id)
      failed++
    }
  }

  console.log(`[Processor] Done: ${processed} processed, ${failed} failed`)

  // Log job finish
  if (jobId) {
    await supabase.from('job_runs').update({
      status: failed > 0 && processed === 0 ? 'failed' : 'success',
      finished_at: new Date().toISOString(),
      success_count: processed,
      fail_count: failed,
    }).eq('id', jobId)
  }

  return { processed, failed }
}
