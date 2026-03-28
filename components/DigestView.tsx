'use client'

import { useState, useMemo } from 'react'
import { pangu } from '@/lib/utils/pangu'

interface Props {
  markdown: string
  date: string
}

interface CategorySection {
  title: string      // e.g. "📡 行业动态 (14)"
  label: string      // e.g. "行业动态"
  count: number
  content: string    // raw markdown of articles in this category
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^(.+\| 来源:.+)$/gm, '<p class="source-line">$1</p>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hbpHBP])(.+)$/gm, '$1')
    .split('\n').join('\n')
}

function parseDigest(md: string): { headerMd: string; categories: CategorySection[] } {
  const categoryStart = md.indexOf('## 📊 分类速览')
  if (categoryStart === -1) {
    return { headerMd: md, categories: [] }
  }

  const headerMd = md.slice(0, categoryStart).trim()
  const categorySection = md.slice(categoryStart)

  // Split by ### headings
  const parts = categorySection.split(/^(?=### )/m).filter(s => s.trim())
  // First part is the "## 📊 分类速览" heading itself, skip it
  const categories: CategorySection[] = []

  for (const part of parts) {
    const match = part.match(/^### (.+?)(?:\n|$)/)
    if (!match) continue

    const title = match[1].trim()
    // Parse "📡 行业动态 (14)" -> label="行业动态", count=14
    const labelMatch = title.match(/^.+?\s+(.+?)\s*\((\d+)\)$/)
    const label = labelMatch ? labelMatch[1] : title.replace(/^.+?\s+/, '')
    const count = labelMatch ? parseInt(labelMatch[2]) : 0

    const content = part.slice(match[0].length).trim()
    if (content) {
      categories.push({ title, label, count, content })
    }
  }

  return { headerMd, categories }
}

export default function DigestView({ markdown, date }: Props) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  const { headerMd, categories } = useMemo(() => parseDigest(pangu(markdown)), [markdown])

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
        <p style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.25em', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>
          {date}
        </p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(markdown)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          style={{
            fontSize: 'var(--text-xs)', letterSpacing: '0.08em', color: 'var(--text-muted)',
            textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer',
            transition: 'color 200ms ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-body)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Top section: title + summary + stats */}
      <div className="digest-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(headerMd) }} />

      {/* Category tabs */}
      {categories.length > 0 && (
        <div style={{ marginTop: 'var(--space-xl)' }}>
          {/* Section heading */}
          <h2 style={{
            fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-body)',
            marginBottom: 'var(--space-lg)', paddingBottom: 'var(--space-md)',
            borderBottom: '1px solid var(--border)',
          }}>
            分类速览
          </h2>

          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: '0.25rem', marginBottom: 'var(--space-xl)',
            borderBottom: '1px solid var(--border)', paddingBottom: '0',
            overflowX: 'auto',
          }}>
            {categories.map((cat, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                style={{
                  fontSize: 'var(--text-sm)', fontWeight: activeTab === i ? 600 : 400,
                  color: activeTab === i ? 'var(--text-body)' : 'var(--text-muted)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0.5rem 0.75rem',
                  borderBottom: activeTab === i ? '2px solid var(--text-body)' : '2px solid transparent',
                  marginBottom: '-1px',
                  transition: 'color 200ms ease, border-color 200ms ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  if (activeTab !== i) e.currentTarget.style.color = 'var(--text-body)'
                }}
                onMouseLeave={e => {
                  if (activeTab !== i) e.currentTarget.style.color = 'var(--text-muted)'
                }}
              >
                {cat.label}
                <span style={{
                  fontSize: 'var(--text-xs)', color: 'var(--text-faint)',
                  marginLeft: '0.375rem', fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div
            key={activeTab}
            className="digest-content"
            style={{
              animation: 'fadeIn 250ms ease',
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(categories[activeTab].content) }}
          />
        </div>
      )}
    </div>
  )
}
