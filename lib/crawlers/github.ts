import * as cheerio from 'cheerio'
import type { RawArticle } from '../types'

const AI_TOPIC_KEYWORDS = [
  'llm', 'ai', 'gpt', 'llama', 'transformer', 'diffusion', 'neural',
  'pytorch', 'tensorflow', 'hugging', 'langchain', 'openai', 'anthropic',
  'machine-learning', 'deep-learning', 'embedding', 'vector', 'rag',
  'agent', 'inference', 'fine-tun',
]

function isAIRepo(name: string, description: string): boolean {
  const text = (name + ' ' + description).toLowerCase()
  return AI_TOPIC_KEYWORDS.some(kw => text.includes(kw))
}

export async function crawlGitHubTrending(): Promise<RawArticle[]> {
  const results: RawArticle[] = []

  // Crawl both "today" and "this week" pages for more coverage
  const periods = ['daily', 'weekly'] as const

  for (const period of periods) {
    try {
      const url = `https://github.com/trending?since=${period}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AI-Radar/1.0' },
        next: { revalidate: 0 },
      })
      if (!res.ok) continue
      const html = await res.text()
      const $ = cheerio.load(html)

      $('article.Box-row').each((_, el) => {
        const $el = $(el)
        const repoPath = $el.find('h2 a').attr('href')?.trim().replace(/^\//, '')
        if (!repoPath) return

        const name = repoPath
        const description = $el.find('p').first().text().trim()
        const stars = $el.find('[aria-label="star"]').parent().text().trim()
        const language = $el.find('[itemprop="programmingLanguage"]').text().trim()

        if (!isAIRepo(name, description)) return

        results.push({
          source_slug: 'github-trending',
          source_name: 'GitHub Trending (AI)',
          title: `${repoPath} - ${description || 'AI/ML repository'}`,
          url: `https://github.com/${repoPath}`,
          content: `⭐ ${stars} | Language: ${language || 'N/A'} | ${description}`,
          published_at: new Date(), // trending today
        })
      })
    } catch (err) {
      console.error(`[GitHub Trending] Failed for period=${period}:`, err)
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  return results.filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
}
