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
      <header className="mb-10 pb-6 border-b border-gray-200">
        <Link href="/" className="font-mono text-[11px] text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-widest">
          ← News
        </Link>
        <h1 className="text-[1.75rem] font-semibold text-gray-900 tracking-tight leading-none mt-4">简报归档</h1>
        <p className="text-[15px] text-gray-600 mt-3">每天 8:00 AM 自动生成，覆盖过去 24 小时 AI 动态</p>
      </header>

      {(!digests || digests.length === 0) ? (
        <p className="text-center py-24 text-sm text-gray-400">暂无简报，等待首次生成</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100">
          {digests.map(d => (
            <Link
              key={d.id}
              href={`/digest/${d.date}`}
              className="flex items-center justify-between py-5 group transition-colors hover:bg-gray-50 -mx-2 px-2 rounded-lg"
            >
              <div>
                <p className="text-[15px] font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                  {d.date}
                </p>
                <p className="font-mono text-[11px] text-gray-400 mt-1">
                  {d.stats?.total || 0} 条 · 均分 {d.stats?.avg_importance || '—'}/10
                </p>
              </div>
              <svg className="w-3.5 h-3.5 stroke-gray-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
