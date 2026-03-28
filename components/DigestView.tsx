'use client'

import { useState } from 'react'
import { pangu } from '@/lib/utils/pangu'

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
    .replace(/^(.+\| 来源:.+)$/gm, '<p class="source-line">$1</p>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hbpHBP])(.+)$/gm, '$1')
    .split('\n').join('\n')
}

export default function DigestView({ markdown, date }: Props) {
  const [copied, setCopied] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <p className="font-mono text-[0.72rem] text-[#BBB] uppercase tracking-widest">{date}</p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(markdown)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="font-mono text-[0.72rem] text-[#777] hover:text-[#111] transition-colors uppercase tracking-widest"
        >
          {copied ? 'Copied' : 'Copy MD'}
        </button>
      </div>
      <div className="prose-light max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(pangu(markdown)) }} />
    </div>
  )
}
