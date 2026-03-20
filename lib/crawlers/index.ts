// ======================================================
// AI Radar - Main Crawler Orchestrator
// ======================================================

import { createServiceClient } from '../supabase'
import { SOURCE_CONFIGS } from './sources'
import { crawlRSS } from './rss'
import { crawlHackerNews } from './hackernews'
import { crawlGitHubTrending } from './github'
import { crawlHuggingFaceTrending } from './huggingface'
import { crawlTwitterUser } from './twitter'
import { titleHash } from '../utils/dedup'
import type { RawArticle, SourceConfig } from '../types'

const SOURCE_TIMEOUT_MS = 20_000

export async function runAllCrawlers(): Promise<{ inserted: number; skipped: number }> {
  const supabase = createServiceClient()

  // Log job start
  const { data: job } = await supabase
    .from('job_runs')
    .insert({ job_type: 'crawl', status: 'running' })
    .select('id')
    .single()
  const jobId = job?.id

  try {
    // 1. Ensure sources exist in DB
    await upsertSources(supabase)

    // 2. Run all crawlers with per-source timeout
    const rawArticles = await fetchAllSources()
    console.log(`[Crawler] Fetched ${rawArticles.length} raw articles`)

    // 3. Deduplicate against existing URLs
    const urls = rawArticles.map(a => a.url)
    const { data: existing } = await supabase
      .from('articles')
      .select('url')
      .in('url', urls)

    const existingUrls = new Set((existing || []).map(r => r.url))
    let newArticles = rawArticles.filter(a => !existingUrls.has(a.url))

    // 4. Title-based dedup against DB
    const hashes = newArticles.map(a => titleHash(a.title))
    const { data: existingHashes } = await supabase
      .from('articles')
      .select('normalized_title_hash')
      .in('normalized_title_hash', hashes)

    const existingHashSet = new Set((existingHashes || []).map(r => r.normalized_title_hash))
    const beforeTitleDedup = newArticles.length
    newArticles = newArticles.filter(a => !existingHashSet.has(titleHash(a.title)))
    const titleDedupCount = beforeTitleDedup - newArticles.length
    if (titleDedupCount > 0) {
      console.log(`[Crawler] Title dedup removed ${titleDedupCount} articles`)
    }

    console.log(`[Crawler] ${newArticles.length} new articles after dedup`)

    if (newArticles.length === 0) {
      await finishJob(supabase, jobId, 'success', 0, 0)
      return { inserted: 0, skipped: rawArticles.length }
    }

    // 5. Insert new articles with title hash
    const { error } = await supabase.from('articles').upsert(
      newArticles.map(a => ({
        source_slug: a.source_slug,
        source_name: a.source_name,
        title: a.title.slice(0, 500),
        url: a.url,
        content: a.content?.slice(0, 5000),
        author: a.author,
        published_at: a.published_at?.toISOString(),
        is_processed: false,
        normalized_title_hash: titleHash(a.title),
      })),
      { onConflict: 'url', ignoreDuplicates: true }
    )

    if (error) {
      console.error('[Crawler] Insert error:', error)
      await finishJob(supabase, jobId, 'failed', 0, 0, error.message)
      throw new Error(`Insert failed: ${error.message}`)
    }

    // 6. Update last_crawled_at for sources
    const crawledSlugs = [...new Set(newArticles.map(a => a.source_slug))]
    await supabase
      .from('sources')
      .update({ last_crawled_at: new Date().toISOString() })
      .in('slug', crawledSlugs)

    await finishJob(supabase, jobId, 'success', newArticles.length, existingUrls.size)
    return { inserted: newArticles.length, skipped: existingUrls.size }
  } catch (err) {
    await finishJob(supabase, jobId, 'failed', 0, 0, String(err))
    throw err
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ])
}

async function fetchAllSources(): Promise<RawArticle[]> {
  const supabase = createServiceClient()
  const allResults: RawArticle[] = []
  const promises: { slug: string; promise: Promise<RawArticle[]> }[] = []

  for (const source of SOURCE_CONFIGS) {
    if (!source) continue

    if (source.type === 'rss') {
      promises.push({
        slug: source.slug,
        promise: withTimeout(crawlRSS(source), SOURCE_TIMEOUT_MS, source.slug),
      })
    } else if (source.type === 'twitter' && source.twitter_username) {
      promises.push({
        slug: source.slug,
        promise: withTimeout(
          crawlTwitterUser(source.twitter_username, source.name, source.slug),
          SOURCE_TIMEOUT_MS,
          source.slug
        ),
      })
    }
  }

  // Special crawlers
  promises.push({ slug: 'hackernews', promise: withTimeout(crawlHackerNews(50), SOURCE_TIMEOUT_MS, 'hackernews') })
  promises.push({ slug: 'github-trending', promise: withTimeout(crawlGitHubTrending(), SOURCE_TIMEOUT_MS, 'github-trending') })
  promises.push({ slug: 'huggingface-trending', promise: withTimeout(crawlHuggingFaceTrending(), SOURCE_TIMEOUT_MS, 'huggingface-trending') })

  const results = await Promise.allSettled(promises.map(p => p.promise))

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const slug = promises[i].slug

    if (result.status === 'fulfilled') {
      allResults.push(...result.value)
      await updateSourceHealth(supabase, slug, true)
    } else {
      console.error(`[Crawler] ${slug} failed:`, result.reason)
      await updateSourceHealth(supabase, slug, false, String(result.reason))
    }
  }

  return allResults
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateSourceHealth(supabase: any, slug: string, success: boolean, error?: string) {
  try {
    const now = new Date().toISOString()
    const { data: existing } = await supabase
      .from('source_health')
      .select('*')
      .eq('source_slug', slug)
      .single()

    if (existing) {
      await supabase.from('source_health').update({
        total_runs: existing.total_runs + 1,
        success_runs: existing.success_runs + (success ? 1 : 0),
        last_success: success ? now : existing.last_success,
        last_failure: success ? existing.last_failure : now,
        last_error: success ? existing.last_error : error,
        consecutive_failures: success ? 0 : existing.consecutive_failures + 1,
        updated_at: now,
      }).eq('source_slug', slug)
    } else {
      await supabase.from('source_health').insert({
        source_slug: slug,
        total_runs: 1,
        success_runs: success ? 1 : 0,
        last_success: success ? now : null,
        last_failure: success ? null : now,
        last_error: success ? null : error,
        consecutive_failures: success ? 0 : 1,
        updated_at: now,
      })
    }
  } catch {
    // Don't let health tracking break the crawl
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function finishJob(supabase: any, jobId: string | undefined, status: string, success: number, fail: number, error?: string) {
  if (!jobId) return
  try {
    await supabase.from('job_runs').update({
      status,
      finished_at: new Date().toISOString(),
      success_count: success,
      fail_count: fail,
      error_message: error || null,
    }).eq('id', jobId)
  } catch {
    // Don't let job tracking break the crawl
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertSources(supabase: any) {
  const sourcesData = SOURCE_CONFIGS.map(s => ({
    slug: s.slug,
    name: s.name,
    type: s.type,
    category: s.category,
    url: s.url,
    home_url: s.home_url,
    priority: s.priority,
    is_active: true,
  }))

  const { error } = await supabase
    .from('sources')
    .upsert(sourcesData, { onConflict: 'slug', ignoreDuplicates: false })

  if (error) {
    console.error('[Crawler] Source upsert error:', error)
  }
}
