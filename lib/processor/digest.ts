// ======================================================
// AI Radar - Daily Digest Generator
// ======================================================

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { anthropic, HAIKU_MODEL, SONNET_MODEL } from '../claude'
import { createServiceClient } from '../supabase'
import { categoryLabel } from '../i18n/categories'
import type { EnrichedArticle, DigestStats, ContentCategory } from '../types'

const CATEGORY_EMOJI: Record<ContentCategory, string> = {
  model_release: '🚀',
  product_tool: '🛠️',
  research_paper: '📄',
  industry_news: '📡',
  funding_ma: '💰',
  policy_regulation: '⚖️',
  open_source: '🔧',
  opinion_insight: '💡',
}

const SCORE_LABEL: Record<number, string> = {
  10: '🔴 极重要', 9: '🔴 极重要',
  8: '🟠 重要', 7: '🟠 重要',
  6: '🟡 值得关注', 5: '🟡 值得关注',
  4: '⚪ 一般', 3: '⚪ 一般',
  2: '⚪ 普通', 1: '⚪ 普通',
}

export async function generateDailyDigest(date: string): Promise<string> {
  const supabase = createServiceClient()

  // Fetch top articles from the past 24h, ordered by importance
  const startOfDay = new Date(date + 'T00:00:00.000Z')
  const endOfDay = new Date(date + 'T23:59:59.999Z')

  const { data: articles, error } = await supabase
    .from('enriched_articles')
    .select('*')
    .gte('published_at', startOfDay.toISOString())
    .lte('published_at', endOfDay.toISOString())
    .order('importance_score', { ascending: false })
    .limit(100)

  if (error) throw new Error(`Digest fetch error: ${error.message}`)

  // Also include articles crawled today but without published_at
  const { data: crawledToday } = await supabase
    .from('enriched_articles')
    .select('*')
    .gte('crawled_at', startOfDay.toISOString())
    .lte('crawled_at', endOfDay.toISOString())
    .order('importance_score', { ascending: false })
    .limit(50)

  // Merge and deduplicate
  const all = [...(articles || []), ...(crawledToday || [])]
  const seen = new Set<string>()
  const enriched: EnrichedArticle[] = all.filter(a => {
    if (seen.has(a.id)) return false
    seen.add(a.id)
    return true
  }).sort((a, b) => b.importance_score - a.importance_score)

  if (enriched.length === 0) {
    return `# AI Radar 日报 ${date}\n\n今日暂无数据。`
  }

  // Take top 30 for digest
  const top = enriched.slice(0, 30)

  // Compute stats
  const stats: DigestStats = {
    total: enriched.length,
    by_category: {},
    avg_importance: Math.round(
      enriched.reduce((s, a) => s + a.importance_score, 0) / enriched.length * 10
    ) / 10,
  }
  for (const a of enriched) {
    stats.by_category[a.content_category] = (stats.by_category[a.content_category] || 0) + 1
  }

  // Generate AI executive summary
  const executiveSummary = await generateExecutiveSummary(top.slice(0, 15))

  // Build Markdown digest
  const dateFormatted = format(new Date(date), 'yyyy年M月d日 EEEE', { locale: zhCN })
  const md = buildMarkdown(dateFormatted, executiveSummary, top, stats)

  // Save to DB
  await supabase.from('daily_digests').upsert({
    date,
    content_md: md,
    top_article_ids: top.map(a => a.id),
    stats,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'date' })

  return md
}

async function generateExecutiveSummary(articles: EnrichedArticle[]): Promise<string> {
  const articleList = articles
    .map((a, i) =>
      `${i + 1}. [${SCORE_LABEL[a.importance_score] || ''}] ${a.title}\n   ${a.why_it_matters}`
    )
    .join('\n')

  const prompt = `基于以下今日 AI 资讯，写一段面向 AI 从业者的每日深度分析总结，用中文。

要求：
- 概括今天的整体趋势和最值得关注的方向
- 分析这些事件背后的深层含义、行业影响和未来走向
- 总字数控制在200-300字，用1个自然段写完，超过300字视为不合格
- 直接输出一段连贯的分析文字，不要分条列举，不要加标题或 emoji

${articleList}

直接输出内容。`

  const toErrText = (err: unknown): string => {
    if (err && typeof err === 'object') {
      const anyErr = err as any
      if (typeof anyErr.error === 'string') return anyErr.error
      if (anyErr.error && typeof anyErr.error === 'object') {
        if (typeof anyErr.error.error === 'string') return anyErr.error.error
        if (typeof anyErr.error.message === 'string') return anyErr.error.message
      }
      if (typeof anyErr.message === 'string') return anyErr.message
    }
    return String(err)
  }

  const modelsToTry = Array.from(
    new Set(
      [
        SONNET_MODEL,
        HAIKU_MODEL,
        'claude-sonnet-4-5-20250929',
      ].filter(Boolean)
    )
  )

  let lastErr: unknown = null
  for (const model of modelsToTry) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 280,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      })

      const block = response.content[0]
      const text = block?.type === 'text' ? block.text : ''
      if (text.trim()) return text.trim()
      throw new Error('LLM returned empty summary')
    } catch (err) {
      lastErr = err
      console.warn(`[Digest] Executive summary failed with model=${model}: ${toErrText(err)}`)
    }
  }

  // Hard fallback: generate a deterministic one-paragraph summary so the workflow doesn't block site updates.
  console.warn('[Digest] Executive summary fallback: using heuristic summary due to LLM errors:', toErrText(lastErr))
  const titles = articles
    .slice(0, 5)
    .map(a => String(a.title || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('；')

  const fallback = `今日共收录${articles.length}条 AI 资讯。重点包括：${titles || '（暂无可用标题）'}。整体来看，大模型能力与产品化落地继续并行推进，开源生态与算力/基础设施仍是高频主题。建议关注头部模型与关键工具更新带来的研发效率、成本结构与商业化机会变化。`
  return fallback
}

function buildMarkdown(
  date: string,
  summary: string,
  articles: EnrichedArticle[],
  stats: DigestStats
): string {
  const lines: string[] = []

  // Header
  lines.push(`# 🤖 AI Radar 日报`)
  lines.push(`## ${date}`)
  lines.push('')

  // Stats bar
  lines.push(`> 今日收录 **${stats.total}** 条资讯 | 平均重要性 **${stats.avg_importance}/10** | 来源覆盖 ${Object.keys(stats.by_category).length} 个类别`)
  lines.push('')

  // Executive Summary
  lines.push(`## 📌 今日总结`)
  lines.push('')
  lines.push(summary)
  lines.push('')

  // Top articles by category
  const byCategory: Record<string, EnrichedArticle[]> = {}
  for (const a of articles) {
    if (!byCategory[a.content_category]) byCategory[a.content_category] = []
    byCategory[a.content_category].push(a)
  }

  // Sort categories by total importance
  const sortedCategories = Object.entries(byCategory)
    .sort((a, b) => {
      const sumA = a[1].reduce((s, x) => s + x.importance_score, 0)
      const sumB = b[1].reduce((s, x) => s + x.importance_score, 0)
      return sumB - sumA
    })

  lines.push(`## 📊 分类速览`)
  lines.push('')

  for (const [category, catArticles] of sortedCategories) {
    const emoji = CATEGORY_EMOJI[category as ContentCategory] || '📌'
    const label = categoryLabel(category as ContentCategory)
    lines.push(`### ${emoji} ${label} (${catArticles.length})`)
    lines.push('')

    for (const a of catArticles.slice(0, 5)) {
      const score = SCORE_LABEL[a.importance_score] || `⚪ ${a.importance_score}/10`
      lines.push(`#### [${a.title}](${a.url})`)
      lines.push(`${score} | 来源: ${a.source_name}${a.author ? ` · ${a.author}` : ''}`)
      lines.push('')
      lines.push(`**摘要:** ${a.summary_zh}`)
      lines.push('')
      lines.push(`**为什么重要:** ${a.why_it_matters}`)
      if (a.tags.length > 0) {
        lines.push('')
        lines.push(`**标签:** ${a.tags.map(t => `\`${t}\``).join(' ')}`)
      }
      lines.push('')
      lines.push('---')
      lines.push('')
    }
  }

  // Footer
  lines.push(`\n*由 [AI Radar](/) 自动生成 · 数据来源覆盖 ${stats.total} 篇原文*`)

  return lines.join('\n')
}
