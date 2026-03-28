'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface DigestEntry {
  date: string
  total: number
}

export default function DigestSidebar({ digests }: { digests: DigestEntry[] }) {
  const pathname = usePathname()

  // Extract current date from pathname: /digest/2026-03-28 or /digest (latest)
  const currentDate = pathname.match(/\/digest\/(\d{4}-\d{2}-\d{2})/)?.[1] || digests[0]?.date

  return (
    <aside className="w-44 flex-shrink-0">
      <Link href="/" className="font-mono text-[11px] text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest">
        ← News
      </Link>
      <h2 className="text-[13px] font-semibold text-gray-500 mt-6 mb-3">往期简报</h2>
      <nav className="flex flex-col gap-0.5">
        {digests.map(d => {
          const isActive = d.date === currentDate
          return (
            <Link
              key={d.date}
              href={`/digest/${d.date}`}
              className={`flex items-center justify-between py-1.5 px-2 rounded-md text-[13px] transition-colors ${
                isActive
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span>{d.date.slice(5)}</span>
              <span className="font-mono text-[10px] text-gray-400">{d.total}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
