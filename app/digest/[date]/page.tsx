import { createPublicClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
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

export default async function DigestPage({ params }: PageProps) {
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
      <div className="max-w-2xl mx-auto text-center py-24">
        <p className="text-sm text-gray-500 mb-2">{date}</p>
        <p className="text-[15px] text-gray-600 mb-8">该日简报尚未生成</p>
        <Link href="/" className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">
          ← 返回资讯
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <nav className="flex items-center justify-between mb-10 pb-6 border-b border-gray-200">
        <Link href="/" className="font-mono text-[11px] text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-widest">
          ← News
        </Link>
        <Link href="/digest" className="font-mono text-[11px] text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-widest">
          Archive →
        </Link>
      </nav>
      <DigestView markdown={digest.content_md} date={date} />
    </div>
  )
}
