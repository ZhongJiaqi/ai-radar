'use client'

import { useState } from 'react'

interface Props {
  markdown: string
  date: string
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
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hbpHBP])(.+)$/gm, '$1')
    .split('\n').join('\n')
}

export default function DigestView({ markdown, date }: Props) {
  const [copied, setCopied] = useState(false)
  const html = renderMarkdown(markdown)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[0.85rem] text-[#666]">{date} 日报</p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(markdown)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="text-xs text-[#666] hover:text-[#171717] bg-[#FAFAFA] border border-[#EAEAEA] px-3 py-1.5 rounded-lg transition-colors"
        >
          {copied ? '已复制' : '复制 Markdown'}
        </button>
      </div>
      <div
        className="prose-light max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
