import type { RawArticle } from '../types'

interface HFTrendingModel {
  id: string
  likes: number
  downloads: number
  pipeline_tag?: string
  lastModified: string
}

interface HFTrendingDataset {
  id: string
  likes: number
  downloads: number
  lastModified: string
}

interface HFTrendingResponse {
  recentlyTrending: Array<{ repoType: string; id: string }>
}

const AI_PIPELINE_TAGS = [
  'text-generation', 'text2text-generation', 'question-answering',
  'summarization', 'translation', 'image-to-text', 'text-to-image',
  'visual-question-answering', 'zero-shot-classification',
  'feature-extraction', 'sentence-similarity', 'conversational',
]

export async function crawlHuggingFaceTrending(): Promise<RawArticle[]> {
  const results: RawArticle[] = []

  try {
    // Trending models
    const modelsRes = await fetch(
      'https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=30&full=false',
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 0 } }
    )

    if (modelsRes.ok) {
      const models: HFTrendingModel[] = await modelsRes.json()
      for (const model of models.slice(0, 20)) {
        if (!model.id) continue
        const tag = model.pipeline_tag || ''
        const isAI = !tag || AI_PIPELINE_TAGS.includes(tag)
        if (!isAI) continue

        results.push({
          source_slug: 'huggingface-trending',
          source_name: 'Hugging Face Trending',
          title: `🤗 Trending Model: ${model.id}`,
          url: `https://huggingface.co/${model.id}`,
          content: `Task: ${model.pipeline_tag || 'N/A'} | ❤️ ${model.likes} likes | ⬇️ ${model.downloads} downloads`,
          published_at: new Date(model.lastModified),
        })
      }
    }

    // Trending spaces (demos)
    const spacesRes = await fetch(
      'https://huggingface.co/api/spaces?sort=trendingScore&direction=-1&limit=20&full=false',
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 0 } }
    )

    if (spacesRes.ok) {
      const spaces: Array<{ id: string; likes: number; lastModified: string }> = await spacesRes.json()
      for (const space of spaces.slice(0, 10)) {
        if (!space.id) continue
        results.push({
          source_slug: 'huggingface-trending',
          source_name: 'Hugging Face Trending',
          title: `🤗 Trending Space: ${space.id}`,
          url: `https://huggingface.co/spaces/${space.id}`,
          content: `❤️ ${space.likes} likes | Demo space`,
          published_at: new Date(space.lastModified),
        })
      }
    }
  } catch (err) {
    console.error('[HuggingFace Trending] Crawl failed:', err)
  }

  return results
}
