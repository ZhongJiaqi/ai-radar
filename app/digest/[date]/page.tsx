import { createPublicClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import DigestView from '@/components/DigestView'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ date: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params
  const supabase = createPublicClient()
  const { data: digest } = await supabase
    .from('daily_digests')
    .select('stats')
    .eq('date', date)
    .single()

  const total = digest?.stats?.total ?? 0
  const avg = digest?.stats?.avg_importance ?? 0
  const title = `AI RADAR 日报 ${date}`
  const description = `${date} 全球 AI 动态 — ${total} 条资讯，平均重要性 ${avg}/10`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', publishedTime: `${date}T08:00:00+08:00` },
    twitter: { title, description },
  }
}

export default async function DigestDatePage({ params }: PageProps) {
  const { date } = await params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound()

  const supabase = createPublicClient()
  const { data: digest } = await supabase
    .from('daily_digests')
    .select('*')
    .eq('date', date)
    .single()

  if (!digest) {
    return (
      <div className="text-center py-24">
        <p className="text-sm text-gray-500 mb-2">{date}</p>
        <p className="text-[15px] text-gray-600">该日简报尚未生成</p>
      </div>
    )
  }

  return <DigestView markdown={digest.content_md} date={date} />
}
