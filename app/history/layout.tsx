import { createPublicClient } from '@/lib/supabase'
import DigestSidebar from '@/components/DigestSidebar'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function HistoryLayout({ children }: { children: React.ReactNode }) {
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
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .root-nav { display: none !important; }
        .root-footer { display: none !important; }
        .root-main { max-width: none !important; padding: 0 !important; margin: 0 !important; }
      `}} />
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(247,246,243,0.88)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 'var(--content-width)', margin: '0 auto', padding: '0 1.5rem', height: '2.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/digest" style={{ fontSize: 'var(--text-xs)', fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-body)' }}>
              AI News <span style={{ fontWeight: 300, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>Daily AI Briefing</span>
            </Link>
            <div style={{ display: 'flex', gap: '1.25rem' }}>
              <Link href="/digest" style={{ fontSize: 'var(--text-xs)', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Digest
              </Link>
              <Link href="/history" style={{ fontSize: 'var(--text-xs)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-body)' }}>
                History
              </Link>
            </div>
          </div>
        </nav>

        <div style={{ maxWidth: 'var(--content-width)', margin: '0 auto', padding: 'var(--space-2xl) 1.5rem var(--space-2xl)', display: 'flex', gap: 'var(--space-xl)' }}>
          <DigestSidebar digests={entries} />
          <main style={{ flex: 1, minWidth: 0 }}>
            {children}
          </main>
        </div>

        <footer style={{ padding: 'var(--space-xl) 0', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.15em', color: 'var(--text-faint)' }}>
            AI News — Daily AI Briefing
          </p>
        </footer>
      </div>
    </>
  )
}
