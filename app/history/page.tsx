import { createPublicClient } from '@/lib/supabase'
import DigestView from '@/components/DigestView'
import type { Metadata } from 'next'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('daily_digests')
    .select('date, stats')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  const date = data?.date || '今日'
  const total = data?.stats?.total ?? 0
  const title = `AI RADAR 日报 ${date}`
  const description = `${date} 全球 AI 动态 — ${total} 条资讯`

  return { title, description, openGraph: { title, description } }
}

export default async function DigestPage() {
  const supabase = createPublicClient()
  const { data: latest } = await supabase
    .from('daily_digests')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (!latest) {
    return (
      <div className="text-center py-24">
        <p className="text-[15px] text-gray-600">暂无简报，等待首次生成</p>
      </div>
    )
  }

  return <DigestView markdown={latest.content_md} date={latest.date} />
}
