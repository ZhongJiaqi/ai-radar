// scripts/jobs_crawl.ts — Crawl job signals for AI Jobs module
//
// Sources:
// - Hacker News: "Ask HN: Who is hiring?" (no login, stable fallback)
// - XiaoHongShu (optional): requires xiaohongshu-mcp server + login cookies
import 'dotenv/config'

import { createServiceClient } from '../lib/supabase'
import { titleHash } from '../lib/utils/dedup'

type JobPostInsert = {
  source_slug: string
  source_name: string
  external_id?: string | null
  url: string
  title: string
  raw_text?: string | null
  metrics?: Record<string, unknown>
  posted_at?: string | null
  normalized_hash?: string
  is_processed?: boolean
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function stripHtml(html: string): string {
  const text = String(html || '')
    .replace(/<p>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'user-agent': 'ai-radar/1.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`)
  return res.json() as Promise<T>
}

function withConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  let i = 0
  const results: R[] = []
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await worker(items[idx])
    }
  })
  return Promise.all(runners).then(() => results)
}

async function crawlHnWhoIsHiring(maxTopLevel = 200): Promise<JobPostInsert[]> {
  // Use Algolia search to locate the latest "Who is hiring?" thread.
  const algoliaUrl =
    'https://hn.algolia.com/api/v1/search?query=Ask%20HN%3A%20Who%20is%20hiring%3F&tags=story&hitsPerPage=5'
  const algolia = await fetchJson<any>(algoliaUrl)
  const hits = Array.isArray(algolia?.hits) ? algolia.hits : []
  const hit = hits.find((h: any) => /who is hiring\\?/i.test(String(h.title || ''))) || hits[0]
  if (!hit?.objectID) {
    console.warn('[Jobs:Crawl][HN] No thread found')
    return []
  }

  const threadId = String(hit.objectID)
  const threadUrl = `https://news.ycombinator.com/item?id=${threadId}`

  const story = await fetchJson<any>(`https://hacker-news.firebaseio.com/v0/item/${threadId}.json`)
  const kids: number[] = Array.isArray(story?.kids) ? story.kids : []
  const topLevel = kids.slice(0, maxTopLevel)
  console.log(`[Jobs:Crawl][HN] Thread ${threadId} (${threadUrl}) top-level comments: ${topLevel.length}`)

  const comments = await withConcurrency(topLevel, 20, async (id: number) => {
    const item = await fetchJson<any>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
    return item
  })

  const rows: JobPostInsert[] = []
  for (const c of comments) {
    if (!c || c.deleted || c.dead) continue
    const text = stripHtml(c.text || '')
    if (!text) continue
    const firstLine = text.split('\n').map((l: string) => l.trim()).find(Boolean) || 'HN Hiring'
    const title = firstLine.slice(0, 160)
    const postedAt = c.time ? new Date(Number(c.time) * 1000).toISOString() : null
    rows.push({
      source_slug: 'hn-whoishiring',
      source_name: 'Hacker News — Who is hiring',
      external_id: String(c.id),
      url: `https://news.ycombinator.com/item?id=${c.id}`,
      title,
      raw_text: text.slice(0, 5000),
      metrics: { thread_id: threadId, by: c.by || null, source: 'hn' },
      posted_at: postedAt,
      normalized_hash: titleHash(title),
      is_processed: false,
    })
  }

  console.log(`[Jobs:Crawl][HN] Parsed job signals: ${rows.length}`)
  return rows
}

type McpToolCallResult = { content?: Array<{ type: string; text?: string }> }

async function mcpCall(mcpUrl: string, method: string, params: any): Promise<any> {
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`)
  if (json.error) throw new Error(`MCP error: ${json.error.message || JSON.stringify(json.error)}`)
  return json.result
}

async function mcpTool(mcpUrl: string, name: string, args: any): Promise<string> {
  const result = (await mcpCall(mcpUrl, 'tools/call', {
    name,
    arguments: args,
  })) as McpToolCallResult
  const text = result?.content?.find(b => b.type === 'text')?.text || ''
  return text
}

async function crawlXhsKeywords(): Promise<JobPostInsert[]> {
  const enable = process.env.ENABLE_XHS === '1'
  if (!enable) {
    console.log('[Jobs:Crawl][XHS] ENABLE_XHS not set; skip')
    return []
  }

  const mcpUrl = process.env.XHS_MCP_URL || 'http://localhost:18060/mcp'
  const keywords = (process.env.XHS_KEYWORDS || 'AI招聘,大模型招聘,AIGC招聘,LLM,提示词工程,AI产品经理,算法岗')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 12)
  const pageSize = Math.min(parseInt(process.env.XHS_PAGE_SIZE || '20', 10), 20)
  const perKeyword = Math.min(parseInt(process.env.XHS_PER_KEYWORD || '40', 10), 100)
  const maxPages = Math.max(1, Math.ceil(perKeyword / pageSize))

  console.log(`[Jobs:Crawl][XHS] MCP=${mcpUrl} keywords=${keywords.length} pageSize=${pageSize} perKeyword=${perKeyword}`)

  // Some MCP servers expect initialize; it's a no-op for others.
  try {
    await mcpCall(mcpUrl, 'initialize', {})
  } catch (e) {
    console.warn('[Jobs:Crawl][XHS] initialize failed (continuing):', String(e))
  }

  const allRows: JobPostInsert[] = []

  for (const kw of keywords) {
    let collected = 0
    for (let page = 1; page <= maxPages; page++) {
      const text = await mcpTool(mcpUrl, 'search_feeds', {
        keyword: kw,
        filters: { sort_by: '综合', publish_time: '一周内' },
        page,
        page_size: pageSize,
      })

      let feeds: any[] = []
      try {
        feeds = JSON.parse(text)
      } catch {
        console.warn('[Jobs:Crawl][XHS] Non-JSON search result for keyword:', kw)
        break
      }

      if (!Array.isArray(feeds) || feeds.length === 0) break

      for (const f of feeds) {
        if (collected >= perKeyword) break
        const feedId = f?.id
        const xsecToken = f?.xsecToken || f?.xsec_token
        if (!feedId || !xsecToken) continue

        const detailText = await mcpTool(mcpUrl, 'get_feed_detail', {
          feed_id: String(feedId),
          xsec_token: String(xsecToken),
          load_all_comments: false,
        })

        let detail: any = null
        try {
          detail = JSON.parse(detailText)
        } catch {
          continue
        }

        const note = detail?.note || null
        if (!note?.noteId) continue

        const title = String(note.title || note.desc || '小红书岗位').trim().slice(0, 160)
        const desc = String(note.desc || '').trim()
        const postedAt = note.time ? new Date(Number(note.time) * 1000).toISOString() : null
        const url =
          `https://www.xiaohongshu.com/explore/${encodeURIComponent(String(note.noteId))}` +
          `?xsec_token=${encodeURIComponent(String(note.xsecToken || xsecToken))}&xsec_source=pc_search`

        const interact = note.interactInfo || {}
        const metrics = {
          source: 'xhs',
          keyword: kw,
          liked_count: interact.likedCount,
          comment_count: interact.commentCount,
          collected_count: interact.collectedCount,
          shared_count: interact.sharedCount,
          ip_location: note.ipLocation,
          user: note.user?.nickname || note.user?.nickName || null,
        }

        allRows.push({
          source_slug: 'xhs-ai-jobs',
          source_name: '小红书 — AI岗位',
          external_id: String(note.noteId),
          url,
          title,
          raw_text: `${title}\n\n${desc}`.slice(0, 5000),
          metrics,
          posted_at: postedAt,
          normalized_hash: titleHash(title),
          is_processed: false,
        })

        collected++
      }

      if (collected >= perKeyword) break
      await sleep(800) // be gentle
    }

    console.log(`[Jobs:Crawl][XHS] keyword="${kw}" collected=${collected}`)
    await sleep(600)
  }

  console.log(`[Jobs:Crawl][XHS] Total collected=${allRows.length}`)
  return allRows
}

async function upsertSources() {
  const supabase = createServiceClient()
  await supabase.from('job_sources').upsert([
    {
      slug: 'hn-whoishiring',
      name: 'Hacker News — Who is hiring',
      type: 'hn',
      url: 'https://news.ycombinator.com/',
      priority: 6,
      is_active: true,
    },
    {
      slug: 'xhs-ai-jobs',
      name: '小红书 — AI岗位',
      type: 'xhs',
      url: 'https://www.xiaohongshu.com/',
      priority: 7,
      is_active: true,
    },
    {
      slug: 'company-links',
      name: '公司招聘入口（jobs.md）',
      type: 'links',
      url: null,
      priority: 5,
      is_active: true,
    },
  ], { onConflict: 'slug' })
}

async function main() {
  console.log('[Jobs:Crawl] Starting...')
  await upsertSources()

  const [hnRows, xhsRows] = await Promise.all([
    crawlHnWhoIsHiring(parseInt(process.env.HN_MAX || '200', 10)),
    crawlXhsKeywords(),
  ])

  const rows = [...hnRows, ...xhsRows]
  if (rows.length === 0) {
    console.log('[Jobs:Crawl] No rows to insert.')
    process.exit(0)
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('job_posts')
    .upsert(rows.map(r => ({
      source_slug: r.source_slug,
      source_name: r.source_name,
      external_id: r.external_id || null,
      url: r.url,
      title: r.title,
      raw_text: r.raw_text || null,
      metrics: r.metrics || {},
      posted_at: r.posted_at || null,
      normalized_hash: r.normalized_hash || null,
      is_processed: false,
    })), { onConflict: 'url', ignoreDuplicates: true })

  if (error) {
    console.error('[Jobs:Crawl] Insert failed:', error)
    process.exit(1)
  }

  console.log(`[Jobs:Crawl] Inserted (upsert) ${rows.length} rows (duplicates ignored).`)
  process.exit(0)
}

main().catch(err => {
  console.error('[Jobs:Crawl] Fatal:', err)
  process.exit(1)
})
