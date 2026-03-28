'use client'

import { CONTENT_CATEGORIES, type ContentCategory } from '@/lib/types'
import { categoryLabel } from '@/lib/i18n/categories'

interface Props {
  selected: ContentCategory | null
  onSelect: (cat: ContentCategory | null) => void
  counts: Partial<Record<ContentCategory, number>>
}

export default function CategoryFilter({ selected, onSelect, counts }: Props) {
  const total = Object.values(counts).reduce((s, n) => s + (n || 0), 0)

  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide whitespace-nowrap">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`px-4 py-1.5 min-h-[32px] rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1 ${
          selected === null
            ? 'bg-gray-900 text-white'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        全部
        <span className="ml-1.5 text-xs opacity-70">{total}</span>
      </button>
      {CONTENT_CATEGORIES.map(cat => {
        const count = counts[cat] || 0
        if (count === 0) return null
        return (
          <button
            type="button"
            key={cat}
            onClick={() => onSelect(selected === cat ? null : cat)}
            className={`px-4 py-1.5 min-h-[32px] rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1 ${
              selected === cat
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {categoryLabel(cat)}
            <span className="ml-1.5 text-xs opacity-70">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
