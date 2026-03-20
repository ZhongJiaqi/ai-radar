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
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1 rounded-full text-[0.78rem] font-medium border transition-all ${
          selected === null
            ? 'border-black text-black bg-black/[0.04]'
            : 'border-[#EAEAEA] text-[#666] hover:border-[#666] hover:text-[#171717]'
        }`}
      >
        全部
        <span className="ml-1.5 text-xs opacity-60">{total}</span>
      </button>
      {CONTENT_CATEGORIES.map(cat => {
        const count = counts[cat] || 0
        if (count === 0) return null
        return (
          <button
            key={cat}
            onClick={() => onSelect(selected === cat ? null : cat)}
            className={`px-3 py-1 rounded-full text-[0.78rem] font-medium border transition-all ${
              selected === cat
                ? 'border-black text-black bg-black/[0.04]'
                : 'border-[#EAEAEA] text-[#666] hover:border-[#666] hover:text-[#171717]'
            }`}
          >
            {categoryLabel(cat)}
            <span className="ml-1.5 text-xs opacity-60">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
