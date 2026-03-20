'use client'

import { useState, useMemo, useEffect } from 'react'
import CategoryFilter from '@/components/CategoryFilter'
import { categoryLabel } from '@/lib/i18n/categories'
import { SOURCE_CONFIGS } from '@/lib/crawlers/sources'
import type { EnrichedArticle, ContentCategory, SourceCategory } from '@/lib/types'

interface Props {
  articles: EnrichedArticle[]
  latestDigest: {
    date: string
    stats: { total: number; avg_importance: number }
    generated_at: string
  } | null
}

type SortMode = 'importance' | 'time'

function scoreClass(s: number) {
  if (s >= 8) return 'text-[#0c7a4a] bg-[#0c7a4a]/[0.08]'
  if (s >= 5) return 'text-[#b45309] bg-[#b45309]/[0.08]'
  return 'text-[#666] bg-black/[0.03]'
}

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function DashboardClient({ articles, latestDigest }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory | null>(null)
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [sortMode, setSortMode] = useState<SortMode>('importance')
  const [minScore, setMinScore] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 15
  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<ContentCategory, number>> = {}
    for (const a of articles) {
      counts[a.content_category] = (counts[a.content_category] || 0) + 1
    }
    return counts
  }, [articles])

  // Source list from config (complete) + filter to those with articles
  const sourceList = useMemo(() => {
    const slugsWithArticles = new Set(articles.map(a => a.source_slug))
    return SOURCE_CONFIGS
      .filter(s => slugsWithArticles.has(s.slug))
      .map(s => [s.slug, s.name] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1]))
  }, [articles])
  const sourceCount = SOURCE_CONFIGS.length

  // Weighted score: importance 80% + source priority 20% (both on 10-point scale)
  const weightedScore = (a: EnrichedArticle) =>
    a.importance_score * 0.8 + a.source_priority * 0.2

  // Filtered + sorted
  const filtered = useMemo(() => {
    let result = articles.filter(a => {
      if (selectedCategory && a.content_category !== selectedCategory) return false
      if (sourceFilter !== 'all' && a.source_slug !== sourceFilter) return false
      if (a.importance_score < minScore) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!a.title.toLowerCase().includes(q) && !a.summary_zh.toLowerCase().includes(q)) return false
      }
      return true
    })
    if (sortMode === 'importance') {
      result = [...result].sort((a, b) => weightedScore(b) - weightedScore(a))
    } else {
      result = [...result].sort((a, b) => {
        const ta = new Date(a.published_at || a.crawled_at).getTime()
        const tb = new Date(b.published_at || b.crawled_at).getTime()
        return tb - ta
      })
    }
    return result
  }, [articles, selectedCategory, sourceFilter, minScore, searchQuery, sortMode])

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1) }, [selectedCategory, sourceFilter, minScore, searchQuery, sortMode])

  const highSignal = articles.filter(a => a.importance_score >= 8).length
  const avgScore = articles.length
    ? Math.round(articles.reduce((s, a) => s + a.importance_score, 0) / articles.length * 10) / 10
    : 0
  return (
    <div>
      {/* Stats bar */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#EAEAEA] border border-[#EAEAEA] rounded-lg overflow-hidden mb-6">
        <div className="bg-white p-4 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-black tracking-tight">{articles.length}</span>
          <span className="text-[0.8rem] text-[#666]">今日抓取</span>
        </div>
        <div className="bg-white p-4 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-black tracking-tight">{sourceCount}</span>
          <span className="text-[0.8rem] text-[#666]">监控源</span>
        </div>
        <div className="bg-white p-4 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-black tracking-tight">{highSignal}</span>
          <span className="text-[0.8rem] text-[#666]">高信号</span>
        </div>
        <div className="bg-white p-4 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-black tracking-tight">{avgScore}</span>
          <span className="text-[0.8rem] text-[#666]">平均分</span>
        </div>
      </section>

      {/* Filter bar */}
      <section className="flex items-center gap-3 mb-6 pb-6 border-b border-[#EAEAEA]">
        <div className="relative flex-shrink-0 w-[200px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 stroke-[#999]" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="搜索资讯..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#EAEAEA] rounded-lg py-[7px] pl-9 pr-3 text-[0.85rem] text-[#171717] placeholder-[#999] outline-none focus:border-black transition-colors"
          />
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto scrollbar-hide">
          <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} counts={categoryCounts} />
        </div>
      </section>
      {/* Filter row 2 */}
      <section className="flex flex-wrap items-center gap-4 mb-6">
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="bg-white border border-[#EAEAEA] rounded-lg px-2.5 py-1.5 text-[0.82rem] text-[#171717] outline-none focus:border-black transition-colors appearance-none pr-7 bg-no-repeat bg-[right_8px_center] bg-[length:12px_12px]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}
        >
          <option value="all">全部来源</option>
            {sourceList.map(([slug, name]) => (
              <option key={slug} value={slug}>{name}</option>
            ))}
        </select>

        <div className="flex items-center gap-2 text-[0.82rem] text-[#666]">
          <label className="whitespace-nowrap">重要性 ≥</label>
          <input
            type="range"
            className="score-slider w-[120px]"
            min={1} max={9}
            value={minScore}
            onChange={e => setMinScore(parseInt(e.target.value))}
          />
          <span className="font-mono text-[0.78rem] text-black min-w-[20px]">{minScore}</span>
        </div>

        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setSortMode('importance')}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${
              sortMode === 'importance' ? 'border-black text-black' : 'border-[#EAEAEA] text-[#666] hover:border-[#666]'
            }`}
          >
            按重要性
          </button>
          <button
            onClick={() => setSortMode('time')}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${
              sortMode === 'time' ? 'border-black text-black' : 'border-[#EAEAEA] text-[#666] hover:border-[#666]'
            }`}
          >
            按时间
          </button>
        </div>

        <span className="font-mono text-[0.78rem] text-[#999]">
          {filtered.length} / {articles.length} 条
        </span>
      </section>
      {/* Article list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[#999]">
          <p className="text-lg mb-1">暂无匹配资讯</p>
          <p className="text-sm">请降低过滤条件或等待下次抓取</p>
        </div>
      ) : (
        <section className="flex flex-col">
          {paged.map((a, i) => {
            const isExpanded = expandedId === a.id
            const time = a.published_at ? getTimeAgo(new Date(a.published_at)) : ''
            return (
              <div
                key={a.id}
                className={`article-row cursor-pointer border-b border-[#F0F0F0] transition-colors ${
                  isExpanded ? 'bg-[#FAFAFA]' : 'hover:bg-[#F5F5F5]'
                } ${i === 0 ? 'border-t border-t-[#F0F0F0]' : ''}`}
                style={{ animationDelay: `${i * 0.03}s` }}
                onClick={() => setExpandedId(isExpanded ? null : a.id)}
              >
                <div className="grid grid-cols-[48px_1fr_auto_auto_auto] items-center gap-4 px-4 py-3 max-sm:grid-cols-[40px_1fr_auto] max-sm:gap-2.5">
                  {/* Score */}
                  <div className={`font-mono text-[0.85rem] font-semibold w-10 h-7 flex items-center justify-center rounded ${scoreClass(a.importance_score)}`}>
                    {a.importance_score}
                  </div>
                  {/* Title */}
                  <div className="min-w-0">
                    <div className={`text-[0.92rem] font-medium text-[#171717] leading-snug ${isExpanded ? '' : 'truncate'}`}>
                      {a.title}
                    </div>
                  </div>
                  {/* Source */}
                  <span className="hidden sm:inline font-mono text-[0.72rem] font-medium text-[#666] bg-black/[0.04] px-2 py-0.5 rounded whitespace-nowrap">
                    {a.source_name}
                  </span>
                  {/* Category */}
                  <span className="hidden sm:inline text-[0.72rem] font-medium px-2.5 py-0.5 rounded-full border border-[#EAEAEA] text-[#666] whitespace-nowrap">
                    {categoryLabel(a.content_category)}
                  </span>
                  {/* Time + chevron */}
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline font-mono text-[0.72rem] text-[#999] whitespace-nowrap">{time}</span>
                    <svg className={`w-4 h-4 stroke-[#999] transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
                {/* Expanded panel */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1">
                    <p className="text-[0.85rem] leading-relaxed text-[#666] mb-3 pl-[calc(48px+1rem)] max-sm:pl-[calc(40px+0.6rem)]">
                      {a.summary_zh}
                    </p>
                    <div className="ml-[calc(48px+1rem)] max-sm:ml-[calc(40px+0.6rem)] border-l-2 border-[#0070F3] bg-[#0070F3]/[0.04] rounded-r px-4 py-2.5">
                      <div className="font-mono text-[0.68rem] font-semibold text-[#0070F3] tracking-wide uppercase mb-1">
                        WHY IT MATTERS
                      </div>
                      <p className="text-[0.82rem] leading-relaxed text-[#171717]">
                        {a.why_it_matters}
                      </p>
                    </div>
                    {a.url && (
                      <div className="mt-2 pl-[calc(48px+1rem)] max-sm:pl-[calc(40px+0.6rem)]">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[0.78rem] text-[#0070F3] hover:underline">
                          阅读原文 →
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}

      {/* Pagination */}
      {totalPages > 1 && (() => {
        const startItem = (safePage - 1) * PAGE_SIZE + 1
        const endItem = Math.min(safePage * PAGE_SIZE, filtered.length)
        return (
          <section className="flex items-center justify-between mt-6 pb-4 text-[0.78rem]">
            <span className="text-[#999]">
              显示 {startItem}-{endItem} 条，共 {filtered.length} 条
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setCurrentPage(1); setExpandedId(null) }}
                disabled={safePage <= 1}
                className="w-7 h-7 flex items-center justify-center rounded border border-[#EAEAEA] text-[#666] hover:border-[#666] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                «
              </button>
              <button
                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setExpandedId(null) }}
                disabled={safePage <= 1}
                className="w-7 h-7 flex items-center justify-center rounded border border-[#EAEAEA] text-[#666] hover:border-[#666] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                ‹
              </button>
              <div className="flex items-center gap-1 px-1">
                <span className="text-[#666]">第</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={safePage}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    if (v >= 1 && v <= totalPages) { setCurrentPage(v); setExpandedId(null) }
                  }}
                  className="w-10 h-7 text-center font-mono text-[0.78rem] border border-[#EAEAEA] rounded outline-none focus:border-black transition-colors"
                />
                <span className="text-[#666]">/ {totalPages} 页</span>
              </div>
              <button
                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setExpandedId(null) }}
                disabled={safePage >= totalPages}
                className="w-7 h-7 flex items-center justify-center rounded border border-[#EAEAEA] text-[#666] hover:border-[#666] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                ›
              </button>
              <button
                onClick={() => { setCurrentPage(totalPages); setExpandedId(null) }}
                disabled={safePage >= totalPages}
                className="w-7 h-7 flex items-center justify-center rounded border border-[#EAEAEA] text-[#666] hover:border-[#666] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                »
              </button>
            </div>
          </section>
        )
      })()}
    </div>
  )
}