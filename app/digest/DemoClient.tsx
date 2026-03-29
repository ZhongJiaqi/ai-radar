'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { pangu } from '@/lib/utils/pangu'
import type { EnrichedArticle } from '@/lib/types'

function timeAgo(dateStr: string): string {
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000)
  if (h < 1) return '刚刚'
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) { setShow(true); return }
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShow(true); obs.disconnect() } },
      { threshold: 0.08 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [reduced])
  return (
    <div ref={ref} style={reduced ? {} : {
      opacity: show ? 1 : 0,
      transform: show ? 'none' : 'translateY(10px)',
      transition: `opacity 500ms cubic-bezier(0.25,1,0.5,1) ${delay}ms, transform 500ms cubic-bezier(0.25,1,0.5,1) ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

function ScrollProgress() {
  const [progress, setProgress] = useState(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) return
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      setProgress(h > 0 ? Math.min(window.scrollY / h, 1) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [reduced])
  if (reduced) return null
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, zIndex: 100,
      width: `${progress * 100}%`, height: '2px',
      background: 'var(--accent)',
      opacity: progress > 0.01 ? 0.7 : 0,
      transition: 'opacity 300ms',
    }} />
  )
}

interface Props {
  articles: EnrichedArticle[]
  summary: string[]
  digestDate: string | null
}

export default function DemoClient({ articles, summary, digestDate }: Props) {
  const topArticles = articles.slice(0, 5)
  const restArticles = articles.slice(5, 25)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <ScrollProgress />

      {/* Nav */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{
          background: 'rgba(247,246,243,0.88)',
          borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
          transition: 'border-color 300ms',
        }}
      >
        <div style={{ maxWidth: 'var(--content-width)', margin: '0 auto', padding: '0 1.5rem', height: '2.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/digest" style={{ fontSize: 'var(--text-xs)', fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-body)' }}>
            AI News <span style={{ fontWeight: 300, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>Daily AI Briefing</span>
          </Link>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <Link href="/digest" className="nav-link-active" style={{ fontSize: 'var(--text-xs)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-body)' }}>
              Digest
            </Link>
            <Link href="/history" className="nav-link" style={{ fontSize: 'var(--text-xs)', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              History
            </Link>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 'var(--content-width)', margin: '0 auto', padding: '0 1.5rem' }}>

        {/* ── 今日要点 ── */}
        <section style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-2xl)' }}>
          <Reveal>
            <p style={{ fontSize: 'var(--text-sm)', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 'var(--space-xs)' }}>
              Daily Briefing
            </p>
            <p style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.1em', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', marginBottom: 'var(--space-xl)' }}>
              {digestDate || new Date().toISOString().slice(0, 10)}
            </p>
          </Reveal>
          {summary.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-lg) var(--space-xl)' }}>
              {summary.map((line, i) => (
                <Reveal key={i} delay={i * 80}>
                  <p className="summary-point" style={{ fontSize: '0.9375rem', lineHeight: 1.85, color: 'var(--text-body)', maxWidth: '80ch', paddingLeft: 'var(--space-md)', borderLeft: '1.5px solid var(--border)', transition: 'border-color 250ms cubic-bezier(0.25,1,0.5,1), transform 250ms cubic-bezier(0.25,1,0.5,1)' }}>
                    {pangu(line.replace(/^[-•]\s*/, ''))}
                  </p>
                </Reveal>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>暂无数据</p>
          )}
          <Reveal delay={200}>
            <Link
              href="/history"
              className="history-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginTop: 'var(--space-lg)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}
            >
              完整简报 <span className="history-arrow" style={{ display: 'inline-block', transition: 'transform 250ms cubic-bezier(0.25,1,0.5,1)' }}>→</span>
            </Link>
          </Reveal>
        </section>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* ── 头条 ── */}
        {topArticles.length > 0 && (
          <section style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-xl)' }}>
            <Reveal>
              <p style={{ fontSize: 'var(--text-sm)', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 'var(--space-xl)' }}>
                Top stories
              </p>
            </Reveal>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
              {topArticles.map((a, idx) => (
                <Reveal key={a.id} delay={idx * 60}>
                  <article className="top-story" style={{ paddingBottom: 'var(--space-xl)', borderBottom: idx < topArticles.length - 1 ? '1px solid var(--border)' : 'none', transition: 'transform 300ms cubic-bezier(0.25,1,0.5,1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.02em' }}>
                        {a.source_name}
                      </span>
                      {a.published_at && (
                        <>
                          <span style={{ width: '2px', height: '2px', borderRadius: '50%', background: 'var(--text-faint)', opacity: 0.6 }} />
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                            {timeAgo(a.published_at)}
                          </span>
                        </>
                      )}
                    </div>
                    <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 500, lineHeight: 1.35, letterSpacing: '-0.015em', color: 'var(--text-heading)', marginBottom: '0.875rem' }}>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="top-story-link"
                        style={{ color: 'inherit', transition: 'color 200ms cubic-bezier(0.25,1,0.5,1)' }}
                      >
                        {pangu(a.title)}
                      </a>
                    </h2>
                    <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.75, color: 'var(--text-secondary)', maxWidth: '58ch' }}>
                      {pangu(a.summary_zh)}
                    </p>
                    {a.why_it_matters && !a.why_it_matters.includes('暂时无法获取') && (
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.7, fontStyle: 'italic', maxWidth: '55ch', marginTop: '0.875rem' }}>
                        {pangu(a.why_it_matters)}
                      </p>
                    )}
                  </article>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* ── 更多资讯 ── */}
        {restArticles.length > 0 && (
          <section style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'calc(var(--space-2xl) + var(--space-md))' }}>
            <Reveal>
              <p style={{ fontSize: 'var(--text-sm)', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 'var(--space-xl)' }}>
                More
              </p>
            </Reveal>
            <div>
              {restArticles.map((a, idx) => (
                <Reveal key={a.id} delay={Math.min(idx, 4) * 40}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="more-row"
                    style={{
                      display: 'flex', alignItems: 'baseline', gap: '0.75rem',
                      padding: '0.625rem 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span className="more-row-title" style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-body)', lineHeight: 1.5, transition: 'color 200ms' }}>
                      {pangu(a.title)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{a.source_name}</span>
                      {a.published_at && (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                          {timeAgo(a.published_at)}
                        </span>
                      )}
                      <span className="more-row-arrow" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', opacity: 0, transform: 'translateX(-4px)', transition: 'opacity 200ms, transform 200ms cubic-bezier(0.25,1,0.5,1)' }}>
                        →
                      </span>
                    </span>
                  </a>
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer style={{ padding: 'var(--space-xl) 0', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.15em', color: 'var(--text-faint)' }}>
          AI News — Daily AI Briefing
        </p>
      </footer>
    </div>
  )
}
