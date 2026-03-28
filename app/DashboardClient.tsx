'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import CategoryFilter from '@/components/CategoryFilter'
import { categoryLabel } from '@/lib/i18n/categories'
import { SOURCE_CONFIGS } from '@/lib/crawlers/sources'
import type { EnrichedArticle, ContentCategory, SourceCategory } from '@/lib/types'
import type { ModelDomain, ModelRankingRow } from '@/lib/rankings/types'
import { pangu } from '@/lib/utils/pangu'

interface Props {
  articles: EnrichedArticle[]
  latestDigest: {
    date: string
    stats: { total: number; avg_importance: number }
    generated_at: string
    summary: string | null
  } | null
  modelRankings: ModelRankingRow[]
}

type SortMode = 'importance' | 'time'

function scoreColor(s: number): string {
  if (s >= 8) return 'bg-emerald-50 text-emerald-600'
  if (s >= 5) return 'bg-amber-50 text-amber-600'
  return 'bg-gray-100 text-gray-400'
}

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function DashboardClient({ articles, latestDigest, modelRankings }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory | null>(null)
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [sortMode, setSortMode] = useState<SortMode>('importance')
  const [minScore, setMinScore] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
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

  // Auto-expand top article on page 1 when in importance sort
  useEffect(() => {
    if (safePage === 1 && sortMode === 'importance' && paged.length > 0) {
      setExpandedIds(new Set([paged[0].id]))
    } else {
      setExpandedIds(new Set())
    }
  }, [filtered])

  const domainMeta: Record<ModelDomain, { zh: string; en: string }> = {
    coding: { zh: '编程', en: 'Coding' },
    math: { zh: '数学', en: 'Math' },
    text: { zh: '文本', en: 'Text' },
    image: { zh: '图片', en: 'Image' },
    video: { zh: '视频', en: 'Video' },
    audio: { zh: '语音', en: 'Audio' },
  }
  const domainOrder: ModelDomain[] = ['coding', 'text', 'image', 'video']

  const top1ByDomain = useMemo(() => {
    const map = new Map<ModelDomain, ModelRankingRow>()
    for (const r of modelRankings || []) {
      if (r.rank !== 1) continue
      map.set(r.domain, r)
    }
    return map
  }, [modelRankings])

  return (
    <div>
      {/* Top panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {latestDigest?.summary && (
          <section className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-semibold text-gray-500">今日要点</h2>
              <Link href={`/history/${latestDigest.date}`} className="text-xs text-gray-400 hover:text-gray-800 transition-colors">
                完整简报 &rarr;
              </Link>
            </div>
            <ul className="space-y-4 text-[15px] leading-relaxed text-gray-600">
              {latestDigest.summary.split('\n').filter(Boolean).slice(0, 5).map((line, i) => {
                const cleanLine = line.replace(/^[-•]\s*/, '').substring(0, 150)
                return (
                  <li key={i} className="flex gap-3">
                    <span className="text-gray-300 mt-0.5 flex-shrink-0">•</span>
                    <span>{pangu(cleanLine)}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className={`bg-white rounded-xl border border-gray-100 shadow-sm p-8 ${latestDigest?.summary ? '' : 'md:col-span-3'}`}>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-sm font-semibold text-gray-500">模型排行</h2>
            <Link href="/models" className="text-xs text-gray-400 hover:text-gray-800 transition-colors">
              查看完整 &rarr;
            </Link>
          </div>
          <div className="space-y-5">
            {domainOrder.map(domain => {
              const meta = domainMeta[domain]
              const top = top1ByDomain.get(domain)
              const scoreText =
                typeof top?.score === 'number'
                  ? `${Math.round(top.score)}`
                  : top?.score_label === 'Rank'
                    ? `#${(top as any)?.metadata?.arena_math_rank ?? 1}`
                    : '—'
              return (
                <div key={domain} className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-gray-400 tracking-wider mb-1">{meta.zh}</div>
                    <div className="text-sm font-medium text-gray-800 truncate">{top?.model_name || '—'}</div>
                  </div>
                  {top && <div className="font-mono text-[12px] text-gray-400 flex-shrink-0">{scoreText}</div>}
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 mb-8">
        {/* Row 1: search + category pills */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-shrink-0">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search" placeholder="搜索..." inputMode="search"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm bg-gray-100/50 border border-transparent rounded-full focus:bg-white focus:border-gray-300 outline-none w-48 transition-all text-gray-600 placeholder-gray-400"
            />
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto scrollbar-hide">
            <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} counts={categoryCounts} />
          </div>
        </div>

        {/* Row 2: source + importance + sort */}
        <div className="flex justify-between items-center py-4 border-t border-gray-100 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <select
              value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
              className="bg-transparent border-0 text-xs text-gray-500 outline-none appearance-none cursor-pointer hover:text-gray-900 transition-colors max-w-[60px]"
            >
              <option value="all">全部来源</option>
              {sourceList.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
            </select>

            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">重要性 &ge;</span>
              <input type="range" className="score-slider w-20" min={1} max={9} value={minScore}
                onChange={e => setMinScore(parseInt(e.target.value))} />
              <span className="text-gray-900 font-medium w-3 text-center">{minScore}</span>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            {(['importance', 'time'] as SortMode[]).map(mode => (
              <button type="button" key={mode} onClick={() => setSortMode(mode)}
                className={`text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 rounded-sm ${sortMode === mode ? 'text-gray-900 font-medium' : 'text-gray-400 hover:text-gray-900'}`}>
                {mode === 'importance' ? '重要性排序' : '最新排序'}
              </button>
            ))}
            <span className="text-[11px] text-gray-300">{filtered.length}/{articles.length}</span>
          </div>
        </div>
      </div>

      {/* Articles */}
      {filtered.length === 0 ? (
        <div className="text-center py-28">
          <p className="text-[0.88rem] text-gray-400">暂无匹配资讯</p>
        </div>
      ) : (
        <div className="space-y-10">
          {paged.map((a, i) => {
            const isExpanded = expandedIds.has(a.id)
            const time = a.published_at ? getTimeAgo(new Date(a.published_at)) : ''
            return (
              <article
                key={a.id}
                className="flex gap-6 group cursor-pointer"
                onClick={() => setExpandedIds(prev => {
                  const next = new Set(prev)
                  next.has(a.id) ? next.delete(a.id) : next.add(a.id)
                  return next
                })}
              >
                {/* Score badge */}
                <div className="pt-1">
                  <span className={`flex items-center justify-center w-7 h-7 rounded text-sm font-semibold ${scoreColor(a.importance_score)}`}>
                    {a.importance_score}
                  </span>
                </div>
                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {pangu(a.title)}
                  </h3>
                  <div className="text-[13px] text-gray-500 mb-3 flex items-center gap-2">
                    <span>{a.source_name}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span>{categoryLabel(a.content_category)}</span>
                    {time && <>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span>{time}</span>
                    </>}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="space-y-4">
                      <p className="text-[15px] text-gray-600 leading-relaxed">
                        {pangu(a.summary_zh)}
                      </p>
                      <div className="border-l-2 border-gray-200 pl-4">
                        <p className="font-mono text-[0.72rem] text-gray-400 uppercase tracking-[0.1em] mb-2">Why it matters</p>
                        <p className="text-[15px] text-gray-600 leading-relaxed">{pangu(a.why_it_matters)}</p>
                      </div>
                      {a.url && (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-block text-[13px] text-blue-600 hover:underline underline-offset-2"
                        >
                          阅读原文 →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (() => {
        const startItem = (safePage - 1) * PAGE_SIZE + 1
        const endItem = Math.min(safePage * PAGE_SIZE, filtered.length)
        return (
          <div className="flex items-center justify-between mt-10 py-4 border-t border-gray-200">
            <span className="font-mono text-[0.72rem] text-gray-300">{startItem}–{endItem} / {filtered.length}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setExpandedIds(new Set()) }}
                disabled={safePage <= 1}
                className="font-mono text-[0.75rem] text-gray-500 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed transition-colors px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 rounded-sm">
                ← 上一页
              </button>
              <span className="font-mono text-[0.68rem] text-gray-300 px-2">{safePage} / {totalPages}</span>
              <button type="button" onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setExpandedIds(new Set()) }}
                disabled={safePage >= totalPages}
                className="font-mono text-[0.75rem] text-gray-500 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed transition-colors px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 rounded-sm">
                下一页 →
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
