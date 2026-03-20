import type { RawArticle } from '../types'

const HN_API = 'https://hacker-news.firebaseio.com/v0'

const AI_KEYWORDS = [
  'llm', 'gpt', 'claude', 'gemini', 'ai ', ' ai', 'openai', 'anthropic',
  'mistral', 'hugging', 'nvidia', 'machine learning', 'deep learning',
  'neural', 'transformer', 'diffusion', 'langchain', 'agents',
  'inference', 'fine-tun', 'rag', 'vector', 'embedding', 'stable diffusion',
  'midjourney', 'suno', 'runway', 'cursor', 'copilot',
]

function isAIRelated(title: string): boolean {
  const lower = title.toLowerCase()
  return AI_KEYWORDS.some(kw => lower.includes(kw))
}

interface HNStory {
  id: number
  title: string
  url?: string
  score: number
  time: number
  by: string
  descendants?: number
}

export async function crawlHackerNews(limit = 60): Promise<RawArticle[]> {
  try {
    // Fetch top stories
    const topRes = await fetch(`${HN_API}/topstories.json`, { next: { revalidate: 0 } })
    const topIds: number[] = await topRes.json()

    // Also fetch new stories for AI items that might not be top yet
    const newRes = await fetch(`${HN_API}/newstories.json`, { next: { revalidate: 0 } })
    const newIds: number[] = await newRes.json()

    // Deduplicate and take first 200 total
    const storyIds = [...new Set([...topIds.slice(0, 150), ...newIds.slice(0, 100)])]

    // Fetch story details in parallel batches
    const results: RawArticle[] = []
    const batchSize = 20
    for (let i = 0; i < Math.min(storyIds.length, 300); i += batchSize) {
      const batch = storyIds.slice(i, i + batchSize)
      const stories = await Promise.allSettled(
        batch.map(id =>
          fetch(`${HN_API}/item/${id}.json`).then(r => r.json() as Promise<HNStory>)
        )
      )
      for (const result of stories) {
        if (result.status !== 'fulfilled') continue
        const story = result.value
        if (!story || !story.title || !story.url) continue
        if (!isAIRelated(story.title)) continue
        if (story.score < 20) continue // Filter low-signal items

        results.push({
          source_slug: 'hackernews',
          source_name: 'Hacker News',
          title: story.title,
          url: story.url,
          content: `Score: ${story.score} | Comments: ${story.descendants || 0}`,
          author: story.by,
          published_at: new Date(story.time * 1000),
        })
      }
      if (results.length >= limit) break
    }
    return results.slice(0, limit)
  } catch (err) {
    console.error('[HN] Crawl failed:', err)
    return []
  }
}
