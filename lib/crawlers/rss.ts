import Parser from 'rss-parser'
import type { RawArticle } from '../types'
import type { SourceConfig } from '../types'

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'AI-Radar/1.0 (+https://github.com/ai-radar)',
  },
})

const AI_KEYWORDS = [
  'ai', 'artificial intelligence', 'machine learning', 'deep learning',
  'llm', 'gpt', 'claude', 'gemini', 'language model', 'neural',
  'transformer', 'diffusion', 'agent', 'inference', 'training',
  'openai', 'anthropic', 'mistral', 'nvidia', 'hugging face',
]

export function isAIRelated(text: string): boolean {
  const lower = text.toLowerCase()
  return AI_KEYWORDS.some(kw => lower.includes(kw))
}

export async function crawlRSS(source: SourceConfig): Promise<RawArticle[]> {
  try {
    const feed = await parser.parseURL(source.url)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000) // 48h window

    return feed.items
      .filter(item => {
        if (!item.link || !item.title) return false
        const pubDate = item.pubDate ? new Date(item.pubDate) : null
        if (pubDate && pubDate < cutoff) return false
        // For media sources, filter by AI relevance
        if (source.category === 'media' || source.slug === 'nvidia-ai-blog') {
          return isAIRelated(item.title + ' ' + (item.contentSnippet || ''))
        }
        return true
      })
      .map(item => ({
        source_slug: source.slug,
        source_name: source.name,
        title: item.title!.trim(),
        url: item.link!.trim(),
        content: item.contentSnippet || item.content || item.summary || '',
        author: item.creator || item.author || undefined,
        published_at: item.pubDate ? new Date(item.pubDate) : undefined,
      }))
  } catch (err) {
    console.error(`[RSS] Failed to crawl ${source.slug}:`, err)
    return []
  }
}
