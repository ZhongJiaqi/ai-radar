'use client'

import { useMemo, useState } from 'react'
import type { EnrichedInvestmentEvent } from '@/lib/types'
import {
  INVESTMENT_SECTOR_MAJOR,
  INVESTMENT_SECTOR_MAJOR_LABELS,
  resolveDetail,
} from '@/lib/investment/taxonomy'

function formatTime(s: string | null | undefined): string {
  if (!s) return ''
  const t = Date.parse(s)
  if (!Number.isFinite(t)) return ''
  const diffMin = Math.floor((Date.now() - t) / 60000)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 48) return `${diffH} h ago`
  const diffD = Math.floor(diffH / 24)
  return `${diffD} d ago`
}

export default function InvestmentClient(props: { initialEvents: EnrichedInvestmentEvent[] }) {
  const { initialEvents } = props
  const [query, setQuery] = useState('')
  const [major, setMajor] = useState<string>('全部')

  const majorOptions = useMemo(() => {
    return [
      { slug: '全部', label: '全部' },
      ...INVESTMENT_SECTOR_MAJOR.map(m => ({ slug: m, label: INVESTMENT_SECTOR_MAJOR_LABELS[m] })),
    ]
  }, [])

  const events = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initialEvents.filter(e => {
      if (major !== '全部' && e.sector_major !== major) return false
      if (!q) return true
      const hay = [
        e.article_title,
        e.company || '',
        e.round || '',
        e.amount_text || '',
        e.currency || '',
        e.sector_major,
        e.sector_detail || '',
        e.event_summary_zh,
        e.event_why_it_matters,
        (e.investors || []).join(' '),
        (e.tickers || []).join(' '),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [initialEvents, query, major])

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight">AI Investment</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          从资讯流中自动抽取 AI 产业链投资事件（应用/算力/电力等），并按赛道归档。
        </p>
      </header>

      <section className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <div className="text-sm" style={{ color: 'var(--muted)' }}>
          近 30 天：{events.length} 条事件
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索公司 / 轮次 / 投资方 / 股票代码…"
            className="px-3 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
          />
          <select
            value={major}
            onChange={e => setMajor(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
          >
            {majorOptions.map(o => (
              <option key={o.slug} value={o.slug}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-3">
        {events.map(e => {
          const detail = e.sector_detail ? resolveDetail(e.sector_detail) : null
          const majorLabel = Object.prototype.hasOwnProperty.call(
            INVESTMENT_SECTOR_MAJOR_LABELS,
            e.sector_major
          )
            ? (INVESTMENT_SECTOR_MAJOR_LABELS as Record<string, string>)[e.sector_major]
            : e.sector_major
          return (
            <div
              key={e.event_id}
              className="rounded-xl p-4"
              style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <a
                    href={e.article_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold hover:underline block truncate"
                    title={e.article_title}
                  >
                    {e.article_title}
                  </a>
                  <div className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1" style={{ color: 'var(--muted)' }}>
                    <span>{majorLabel}</span>
                    {detail ? <span>{detail.zh}</span> : null}
                    {e.company ? <span>{e.company}</span> : null}
                    {e.round ? <span>{e.round}</span> : null}
                    {e.amount_text ? <span>{e.amount_text}</span> : null}
                    <span>{formatTime(e.event_processed_at)}</span>
                    <span>重要性 {e.importance_score}/10</span>
                  </div>
                </div>
                <div
                  className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg"
                  style={{
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {e.event_type || 'event'}
                </div>
              </div>

              <div className="text-sm mt-3 leading-relaxed">
                {e.event_summary_zh}
              </div>
              <div className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
                {e.event_why_it_matters}
              </div>

              {(e.investors?.length || e.tickers?.length) ? (
                <div className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                  {e.investors?.length ? `投资方: ${e.investors.slice(0, 6).join(' / ')}` : null}
                  {e.tickers?.length ? ` | Ticker: ${e.tickers.join(' ')}` : null}
                </div>
              ) : null}
            </div>
          )
        })}

        {events.length === 0 && (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            暂无数据。提示：需要先在 Supabase 执行迁移 `004_jobs_investment.sql`，然后跑 `investment_process`。
          </div>
        )}
      </section>
    </div>
  )
}
