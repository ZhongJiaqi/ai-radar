import { createPublicClient } from '@/lib/supabase'
import DigestSidebar from '@/components/DigestSidebar'

export const dynamic = 'force-dynamic'

export default async function DigestLayout({ children }: { children: React.ReactNode }) {
  const supabase = createPublicClient()
  const { data: digests } = await supabase
    .from('daily_digests')
    .select('date, stats')
    .order('date', { ascending: false })
    .limit(30)

  const entries = (digests || []).map(d => ({
    date: d.date,
    total: d.stats?.total || 0,
  }))

  return (
    <div className="flex gap-10 max-w-4xl mx-auto">
      <DigestSidebar digests={entries} />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
