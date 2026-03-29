import { createPublicClient } from '@/lib/supabase'
import { createServiceClient } from '@/lib/supabase'
import { getYesterdayRangeCN } from '@/lib/utils/time'
import { generateExecutiveSummary } from '@/lib/processor/digest'
import { format } from 'date-fns'
import type { EnrichedArticle } from '@/lib/types'
import DemoClient from './DemoClient'

export const revalidate = 60

async function getData() {
  const supabase = createPublicClient()
  const { since, until } = getYesterdayRangeCN()
  const today = format(new Date(), 'yyyy-MM-dd')

  // 查询昨天一整天（北京时间）的文章
  const articlesRes = await supabase
    .from('enriched_articles')
    .select('*')
    .gte('published_at', since)
    .lt('published_at', until)
    .gte('importance_score', 5)
    .order('importance_score', { ascending: false })
    .limit(30)

  const articles = (articlesRes.data || []) as EnrichedArticle[]

  // 查缓存：今天的 digest（覆盖昨天的文章）
  const { data: cached } = await supabase
    .from('daily_digests')
    .select('date, content_md, stats')
    .eq('date', today)
    .single()

  let summary: string[] = []
  if (cached?.content_md) {
    // 从缓存提取摘要
    const md = cached.content_md
    const start = md.indexOf('## 今日总结')
    const end = md.indexOf('\n## ', start + 1)
    if (start !== -1) {
      const text = (end === -1 ? md.slice(start) : md.slice(start, end))
        .replace('## 今日总结', '').trim()
      summary = text.split('\n').filter((l: string) => l.trim().length > 10).slice(0, 8)
    }
  } else if (articles.length > 0) {
    // 未命中缓存，实时生成摘要
    try {
      const summaryText = await generateExecutiveSummary(articles)
      summary = summaryText.split('\n').filter((l: string) => l.trim().length > 10).slice(0, 8)

      // 写入缓存（best-effort）
      const serviceClient = createServiceClient()
      await serviceClient.from('daily_digests').upsert({
        date: today,
        content_md: `## 今日总结\n\n${summaryText}`,
        top_article_ids: articles.slice(0, 30).map(a => a.id),
        stats: {
          total: articles.length,
          avg_importance: Math.round(
            articles.reduce((s, a) => s + a.importance_score, 0) / articles.length * 10
          ) / 10,
        },
        generated_at: new Date().toISOString(),
      }, { onConflict: 'date' })
    } catch (err) {
      console.warn('[Digest] Real-time summary generation failed:', err)
    }
  }

  return {
    articles,
    summary,
    digestDate: today,
  }
}

export default async function DemoPage() {
  const data = await getData()
  return <DemoClient {...data} />
}
