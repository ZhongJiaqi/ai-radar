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
  const description = `${date} 全球 AI 行业动态速览 — ${total} 条资讯，平均重要性 ${avg}/10`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: `${date}T08:00:00+08:00`,
    },
    twitter: {
      title,
      description,
    },
  }
}

export default async function DigestPage({ params }: PageProps) {
  const { date } = await params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound()
  }

  const supabase = createPublicClient()
  const { data: digest } = await supabase
    .from('daily_digests')
    .select('*')
    .eq('date', date)
    .single()

  if (!digest) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg text-[#666] mb-2">{date} 的简报尚未生成</h2>
        <p className="text-[0.85rem] text-[#999] mb-6">简报每天早上 8 点自动生成</p>
        <Link href="/" className="text-[0.85rem] text-[#0070F3] hover:underline">
          ← 返回今日资讯
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-[#666] hover:text-[#171717] transition-colors">
          ← 返回资讯列表
        </Link>
        <Link href="/digest" className="text-sm text-[#666] hover:text-[#171717] transition-colors">
          查看归档 →
        </Link>
      </div>

      <DigestView markdown={digest.content_md} date={date} />
    </div>
  )
}
