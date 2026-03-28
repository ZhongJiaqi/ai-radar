// ======================================================
// AI Radar - Daily Digest Generator
// ======================================================

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { generateText } from '../llm'
import { createServiceClient } from '../supabase'
import { categoryLabel } from '../i18n/categories'
import type { EnrichedArticle, DigestStats, ContentCategory } from '../types'
import { pangu } from '../utils/pangu'

const CATEGORY_EMOJI: Record<ContentCategory, string> = {
  model_release: '',
  product_tool: '',
  research_paper: '',
  industry_news: '',
  funding_ma: '',
  policy_regulation: '',
  open_source: '',
  opinion_insight: '',
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

  // Fetch articles from the past 48h with importance >= 5
  // This matches the frontend demo page query for consistency
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: articles, error } = await supabase
    .from('enriched_articles')
    .select('*')
    .or(`published_at.gte.${since},crawled_at.gte.${since}`)
    .gte('importance_score', 5)
    .order('importance_score', { ascending: false })
    .limit(100)

  if (error) throw new Error(`Digest fetch error: ${error.message}`)

  const enriched: EnrichedArticle[] = (articles || [])
    .sort((a, b) => b.importance_score - a.importance_score)

  if (enriched.length === 0) {
    return `# AI 每日简报 ${date}\n\n今日暂无数据。`
  }

  // Top 30 for digest — same as frontend display
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

  // Generate AI executive summary from the same articles shown on frontend
  const executiveSummary = await generateExecutiveSummary(top)

  // Build Markdown digest
  const dateFormatted = format(new Date(date), 'yyyy年M月d日 EEEE', { locale: zhCN })
  const md = pangu(buildMarkdown(dateFormatted, executiveSummary, top, stats))

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

  const prompt = `你是 AI 行业分析师，面向中国 AI 从业者（产品经理、开发者、创业者）撰写每日要点。

基于以下今日资讯，提炼 3-4 个最值得关注的要点。

写作要求：
- 每个要点一行，50-80 字，用完整的中文句子，必须有逗号和句号等标点符号
- 中英文之间加空格（例如"OpenAI 发布"而不是"OpenAI发布"）
- 不要复述新闻标题，要分析"这意味着什么"和"从业者该怎么应对"
- 风格参考下方每条资讯的"核心影响"字段，直接点明对从业者的影响或机会
- 不加序号、emoji、符号，直接输出要点内容
- 每个要点之间用换行符分隔

示例（仅供参考格式，内容请根据实际资讯撰写）：
OpenAI 广告业务两月内年化营收破亿美元，标志着大模型商业化从 API 调用扩展到广告分发，开发者应关注 AI 原生广告平台带来的新变现渠道。
内存芯片股因 AI 需求预期回调蒸发千亿美元，提醒从业者重新审视硬件供应链的周期性风险，避免过度依赖短缺预期做采购决策。

${articleList}

直接输出要点，每个一行。`

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

  let lastErr: unknown = null
  try {
    const response = await generateText({
      task: 'digest',
      prompt,
      maxTokens: 400,
    })
    if (response.text.trim()) return pangu(response.text.trim())
    throw new Error('LLM returned empty summary')
  } catch (err) {
    lastErr = err
    console.warn(`[Digest] Executive summary failed: ${toErrText(err)}`)
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
  lines.push(`# AI 每日简报`)
  lines.push(`## ${date}`)
  lines.push('')

  // Stats bar
  lines.push(`> 今日收录 **${stats.total}** 条资讯 | 平均重要性 **${stats.avg_importance}/10** | 来源覆盖 ${Object.keys(stats.by_category).length} 个类别`)
  lines.push('')

  // Executive Summary
  lines.push(`## 今日总结`)
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

  lines.push(`## 分类速览`)
  lines.push('')

  for (const [category, catArticles] of sortedCategories) {
    const label = categoryLabel(category as ContentCategory)
    lines.push(`### ${label} (${catArticles.length})`)
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

  return lines.join('\n')
}
