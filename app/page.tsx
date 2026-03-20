import { createPublicClient } from '@/lib/supabase'
import DashboardClient from './DashboardClient'
import type { Metadata } from 'next'
import type { EnrichedArticle } from '@/lib/types'

export const revalidate = 300 // Revalidate every 5 minutes

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

async function getLatestDigest() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('daily_digests')
    .select('date, stats, generated_at')
    .order('date', { ascending: false })
    .limit(1)
    .single()
  return data
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
    title: 'AI RADAR — 全球 AI 资讯聚合平台',
    description: desc,
    openGraph: {
      title: 'AI RADAR — 全球 AI 资讯聚合平台',
      description: desc,
    },
    twitter: {
      title: 'AI RADAR — 全球 AI 资讯聚合平台',
      description: desc,
    },
  }
}

export default async function HomePage() {
  const [articles, latestDigest] = await Promise.all([
    getArticles(),
    getLatestDigest(),
  ])

  return <DashboardClient articles={articles} latestDigest={latestDigest} />
}
