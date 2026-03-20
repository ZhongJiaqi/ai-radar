import { createPublicClient } from '@/lib/supabase'
import Link from 'next/link'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '每日简报归档',
  description: 'AI RADAR 每日简报归档 — 每天 8:00 AM 自动生成，覆盖过去 24 小时全球 AI 动态',
  openGraph: {
    title: '每日简报归档 | AI RADAR',
    description: 'AI RADAR 每日简报归档 — 每天 8:00 AM 自动生成，覆盖过去 24 小时全球 AI 动态',
  },
}

export default async function DigestListPage() {
  const supabase = createPublicClient()
  const { data: digests } = await supabase
    .from('daily_digests')
    .select('id, date, stats, generated_at')
    .order('date', { ascending: false })
    .limit(30)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-sm text-[#666] hover:text-[#171717] transition-colors">
          ← 返回资讯列表
        </Link>
        <h1 className="text-2xl font-bold text-[#171717] mt-3">每日简报归档</h1>
        <p className="text-sm text-[#999] mt-1">
          每天 8:00 AM 自动生成，覆盖过去 24 小时 AI 动态
        </p>
      </div>

      {(!digests || digests.length === 0) ? (
        <div className="text-center py-20 text-[#999]">
          <p>暂无简报，等待首次生成</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {digests.map(d => (
            <Link
              key={d.id}
              href={`/digest/${d.date}`}
              className="flex items-center justify-between px-4 py-4 border-b border-[#F0F0F0] hover:bg-[#F5F5F5] transition-colors group"
            >
              <div>
                <div className="font-medium text-[#171717] group-hover:text-black transition-colors">
                  {d.date} 日报
                </div>
                <div className="text-sm text-[#999] mt-0.5">
                  {d.stats?.total || 0} 条资讯 · 平均重要性 {d.stats?.avg_importance || '—'}/10
                </div>
              </div>
              <svg className="w-4 h-4 stroke-[#999] group-hover:stroke-[#171717] transition-colors" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
