import Parser from 'rss-parser'
import type { RawArticle } from '../types'
import type { SourceConfig } from '../types'

// Real-browser-style UA — many feeds (Substack, gwern, Cloudflare-fronted
// blogs) block obvious bot UAs with 403. Keep an explicit identifier in the
// suffix so server admins can still attribute traffic.
const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; AI-News-Radar/1.0; +https://github.com/ZhongJiaqi/ai-news-radar)',
    Accept:
      'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
})

const AI_KEYWORDS = [
  // 通用
  'ai', 'artificial intelligence', 'machine learning', 'deep learning',
  'neural', 'inference', 'training', 'fine-tune', 'fine tuning',
  // 模型/架构
  'llm', 'gpt', 'claude', 'gemini', 'llama', 'deepseek', 'qwen',
  'grok', 'kimi', 'copilot', 'language model', 'transformer',
  'diffusion', 'stable diffusion', 'midjourney', 'sora', 'multimodal',
  // 技术
  'agent', 'agentic', 'rag', 'embedding', 'reasoning', 'alignment',
  'rlhf', 'token', 'agi',
  // 公司/产品
  'openai', 'anthropic', 'mistral', 'nvidia', 'hugging face',
  'perplexity', 'cursor', 'chatbot',
  // 中文
  '大模型', '人工智能', '机器学习', '智能体',
  'minimax', '智谱', 'glm', 'prompt', '混元', 'hunyuan', 'seedance',
  '豆包', 'doubao', 'openclaw',
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
        // Filter non-official sources by AI relevance
        if (source.category !== 'official') {
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
