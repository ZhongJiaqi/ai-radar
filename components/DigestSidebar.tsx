'use client'

import { usePathname, useRouter } from 'next/navigation'

interface DigestEntry {
  date: string
  total: number
}

export default function DigestSidebar({ digests }: { digests: DigestEntry[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const currentDate = pathname.match(/\/digest\/(\d{4}-\d{2}-\d{2})/)?.[1] || digests[0]?.date

  return (
    <aside style={{ width: '8.5rem', flexShrink: 0, paddingTop: 'var(--space-sm)' }}>
      <p style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 'var(--space-lg)' }}>
        Archive
      </p>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {digests.map(d => {
          const isActive = d.date === currentDate
          return (
            <a
              key={d.date}
              href={`/digest/${d.date}`}
              onClick={(e) => { e.preventDefault(); router.push(`/digest/${d.date}`); router.refresh() }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.375rem 0.5rem', borderRadius: '4px',
                fontSize: 'var(--text-sm)', cursor: 'pointer',
                color: isActive ? 'var(--text-body)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'var(--accent-subtle)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'background 200ms ease, color 200ms ease',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.02)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <span>{d.date.slice(5)}</span>
              <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                {d.total}
              </span>
            </a>
          )
        })}
      </nav>
    </aside>
  )
}
