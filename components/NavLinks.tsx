'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'AI News' },
  { href: '/digest', label: 'Digest' },
]

export default function NavLinks() {
  const pathname = usePathname()

  return (
    <ul className="hidden md:flex items-center gap-8">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <li key={href}>
            <Link
              href={href}
              className={`text-[0.9rem] font-medium transition-colors ${
                isActive ? 'text-black' : 'text-[#666] hover:text-black'
              }`}
            >
              {label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
