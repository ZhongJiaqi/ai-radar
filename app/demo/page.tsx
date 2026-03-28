import { createPublicClient } from '@/lib/supabase'
import Link from 'next/link'
import { pangu } from '@/lib/utils/pangu'
import type { EnrichedArticle } from '@/lib/types'
import DemoClient from './DemoClient'

export const revalidate = 60

async function getData() {
  const supabase = createPublicClient()
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [articlesRes, digestRes] = await Promise.all([
    supabase
      .from('enriched_articles')
      .select('*')
      .or(`published_at.gte.${since},crawled_at.gte.${since}`)
      .gte('importance_score', 5)
      .order('importance_score', { ascending: false })
      .limit(30),
    supabase
      .from('daily_digests')
      .select('date, content_md, stats')
      .order('date', { ascending: false })
      .limit(1)
      .single(),
  ])

  let summary: string[] = []
  if (digestRes.data?.content_md) {
    const md = digestRes.data.content_md
    const start = md.indexOf('## 📌 今日总结')
    const end = md.indexOf('\n## ', start + 1)
    if (start !== -1) {
      const text = (end === -1 ? md.slice(start) : md.slice(start, end))
        .replace('## 📌 今日总结', '').trim()
      summary = text.split('\n').filter((l: string) => l.trim().length > 10)
    }
  }

  return {
    articles: (articlesRes.data || []) as EnrichedArticle[],
    summary,
    digestDate: digestRes.data?.date || null,
  }
}

export default async function DemoPage() {
  const data = await getData()
  return <DemoClient {...data} />
}
