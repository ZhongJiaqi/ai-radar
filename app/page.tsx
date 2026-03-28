import { createPublicClient } from '@/lib/supabase'
import DashboardClient from './DashboardClient'
import type { Metadata } from 'next'
import type { EnrichedArticle } from '@/lib/types'
import type { ModelRankingRow } from '@/lib/rankings/types'

export const revalidate = 60 // Revalidate every minute

async function getArticles(): Promise<EnrichedArticle[]> {
  const supabase = createPublicClient()

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('enriched_articles')
    .select('*')
    .or(`published_at.gte.${since},crawled_at.gte.${since}`)
    .gte('importance_score', 3)
    .order('importance_score', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Failed to fetch articles:', error)
    return []
  }

  return data || []
}

function extractSummary(contentMd: string | null): string | null {
  if (!contentMd) return null
  const start = contentMd.indexOf('## 📌 今日总结')
  if (start === -1) return null
  const afterHeading = contentMd.indexOf('\n', start)
  if (afterHeading === -1) return null
  const nextSection = contentMd.indexOf('\n## ', afterHeading + 1)
  const text = nextSection === -1
    ? contentMd.slice(afterHeading + 1).trim()
    : contentMd.slice(afterHeading + 1, nextSection).trim()
  return text || null
}

async function getLatestDigest() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('daily_digests')
    .select('date, stats, generated_at, content_md')
    .order('date', { ascending: false })
    .limit(1)
    .single()
  if (!data) return null
  return {
    date: data.date,
    stats: data.stats,
    generated_at: data.generated_at,
    summary: extractSummary(data.content_md),
  }
}

async function getModelRankings(): Promise<ModelRankingRow[]> {
  const supabase = createPublicClient()
  try {
    const { data, error } = await supabase
      .from('model_rankings')
      .select('domain, rank, model_key, model_name, score, score_label, source_name, source_url, captured_at, metadata')
      .lte('rank', 3)
      .order('domain', { ascending: true })
      .order('rank', { ascending: true })
      .limit(18)
    if (error) {
      console.error('Failed to fetch model rankings:', error)
      return []
    }
    return (data || []) as ModelRankingRow[]
  } catch (err) {
    console.error('Failed to fetch model rankings:', err)
    return []
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createPublicClient()
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { count: total } = await supabase
    .from('enriched_articles')
    .select('*', { count: 'exact', head: true })
    .or(`published_at.gte.${since},crawled_at.gte.${since}`)
    .gte('importance_score', 3)

  const { count: highSignal } = await supabase
    .from('enriched_articles')
    .select('*', { count: 'exact', head: true })
    .or(`published_at.gte.${since},crawled_at.gte.${since}`)
    .gte('importance_score', 7)

  const desc = `今日 ${total ?? 0} 条 AI 资讯，${highSignal ?? 0} 条高信号 — 3 分钟掌握全球 AI 动态`

  return {
    title: 'AI News — Daily AI Briefing',
    description: desc,
    openGraph: {
      title: 'AI News — Daily AI Briefing',
      description: desc,
    },
    twitter: {
      title: 'AI News — Daily AI Briefing',
      description: desc,
    },
  }
}

export default async function HomePage() {
  const [articles, latestDigest, modelRankings] = await Promise.all([
    getArticles(),
    getLatestDigest(),
    getModelRankings(),
  ])

  return <DashboardClient articles={articles} latestDigest={latestDigest} modelRankings={modelRankings} />
}
