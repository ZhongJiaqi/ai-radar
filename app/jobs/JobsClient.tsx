'use client'

import { useMemo, useState } from 'react'
import type { EnrichedJobPost } from '@/lib/types'

export type JobsLinkSection = {
  title: string
  items: Array<{ name: string; url: string }>
}

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

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

export default function JobsClient(props: {
  sections: JobsLinkSection[]
  initialPosts: EnrichedJobPost[]
}) {
  const { sections, initialPosts } = props
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string>('全部')

  const tags = useMemo(() => {
    const all = initialPosts.flatMap(p => p.tags || [])
    return ['全部', ...uniq(all).slice(0, 30)]
  }, [initialPosts])

  const posts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initialPosts.filter(p => {
      if (tag !== '全部' && !(p.tags || []).includes(tag)) return false
      if (!q) return true
      const hay = [
        p.title,
        p.summary_zh,
        p.company || '',
        p.role_title || '',
        p.location || '',
        (p.tags || []).join(' '),
        p.source_name,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [initialPosts, query, tag])

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight">AI Jobs</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          聚合“最新最热”的 AI 招聘线索，并提供公司招聘入口清单。
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">招聘入口</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map(sec => (
            <div
              key={sec.title}
              className="rounded-xl p-4"
              style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
            >
              <div className="font-semibold mb-2">{sec.title}</div>
              <div className="space-y-2">
                {sec.items.slice(0, 30).map(it => (
                  <a
                    key={it.url}
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm hover:underline"
                    style={{ color: 'var(--fg)' }}
                  >
                    {it.name}
                  </a>
                ))}
              </div>
            </div>
          ))}
          {sections.length === 0 && (
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              未读取到 jobs.md（可在仓库根目录添加/更新）。
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <h2 className="text-lg font-bold">热门岗位线索（近 7 天）</h2>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索公司 / 岗位 / 技能…"
              className="px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
            />
            <select
              value={tag}
              onChange={e => setTag(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
            >
              {tags.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {posts.map(p => (
            <div
              key={p.id}
              className="rounded-xl p-4"
              style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold hover:underline block truncate"
                    title={p.title}
                  >
                    {p.title}
                  </a>
                  <div className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1" style={{ color: 'var(--muted)' }}>
                    <span>{p.company || p.source_name}</span>
                    {p.location ? <span>{p.location}</span> : null}
                    {p.remote ? <span>{p.remote}</span> : null}
                    <span>{formatTime(p.posted_at || p.crawled_at)}</span>
                    <span>{p.source_name}</span>
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
                  热度 {p.hot_score}/10
                </div>
              </div>

              <div className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--fg)' }}>
                {p.summary_zh}
              </div>

              {p.tags?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.tags.slice(0, 8).map(t => (
                    <span
                      key={t}
                      className="text-[11px] px-2 py-1 rounded-full"
                      style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}

          {posts.length === 0 && (
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              暂无数据。提示：需要先在 Supabase 执行迁移 `004_jobs_investment.sql` 并跑 `jobs_crawl/jobs_process`。
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

