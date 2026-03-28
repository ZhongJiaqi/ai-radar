import type { ModelDomain, RankingCandidate } from '../types'
import { stripVendorPrefix } from '../normalize'

const ARENA_BASE = 'https://arena.ai/leaderboard'

function toLinesFromHTML(html: string): string[] {
  const text = html
    .replace(/\r/g, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(
      /<\/\s*(p|div|li|tr|td|th|h1|h2|h3|h4|section|header|footer|article|main|table|thead|tbody|tfoot)\s*>/gi,
      '\n'
    )
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
}

function isIntLine(line: string): boolean {
  return /^[0-9]{1,3}$/.test(line.trim())
}

function isLikelyModelLine(line: string): boolean {
  const s = line.trim()
  if (!s) return false
  if (!/[a-zA-Z]/.test(s)) return false
  if (!/[\d\-]/.test(s)) return false
  if (s.toLowerCase() === 'rank spread') return false
  return true
}

function parseScoreFromLine(line: string): number | null {
  const s = line.trim()
  // Avoid parsing votes/prices/context like "4,059$5 / $25 1M"
  if (!s) return null
  if (/[,$]/.test(s)) return null
  if (/[a-zA-Z]/.test(s)) return null

  // Typical Arena scores are 3-4 digits like "1548+12/-12" or "1318".
  const m = s.match(/^([0-9]{3,4})(?:\s*[\+\-±].*)?$/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

export function parseArenaLeaderboardHTML(html: string, scoreLabel = 'Elo'): RankingCandidate[] {
  const lines = toLinesFromHTML(html)
  const headerIdx = lines.findIndex(l => l === 'Rank')
  if (headerIdx === -1) return []

  const out: RankingCandidate[] = []
  for (let i = headerIdx + 1; i < lines.length && out.length < 10; i++) {
    const maybeRank = lines[i]
    if (!isIntLine(maybeRank)) continue
    const rank = parseInt(maybeRank, 10)
    if (!Number.isFinite(rank) || rank < 1 || rank > 100) continue

    // Collect until next rank appears.
    const block: string[] = []
    for (let j = i + 1; j < lines.length; j++) {
      if (isIntLine(lines[j])) break
      block.push(lines[j])
    }

    const scoreLine = block.find(l => parseScoreFromLine(l) !== null)
    const score = scoreLine ? parseScoreFromLine(scoreLine) : null

    const rawModelLine = block.find(isLikelyModelLine) || ''
    if (!rawModelLine) continue

    const stripped = stripVendorPrefix(rawModelLine)
    out.push({
      rank,
      model_raw: stripped.model || rawModelLine,
      vendor: stripped.vendor || undefined,
      score,
      score_label: scoreLabel,
      metadata: {},
    })
  }

  return out.sort((a, b) => a.rank - b.rank)
}

export function parseArenaOverviewHTMLForMath(html: string): RankingCandidate[] {
  const lines = toLinesFromHTML(html)
  const headerIdx = lines.findIndex(l =>
    l.includes('Overall') &&
    l.includes('Coding') &&
    l.includes('Math') &&
    l.includes('Longer Query')
  )
  if (headerIdx === -1) return []

  const rows: Array<{ model: string; mathRank: number }> = []
  let i = headerIdx + 1
  while (i < lines.length) {
    const modelLine = lines[i]
    if (!modelLine || !/[a-zA-Z]/.test(modelLine)) { i++; continue }

    const { vendor, model } = stripVendorPrefix(modelLine.replace(/^Image:\s*/i, '').trim())
    const cleanedModel = model || modelLine

    const ranks: number[] = []
    let j = i + 1
    while (j < lines.length && ranks.length < 8) {
      const v = parseInt(lines[j], 10)
      if (Number.isFinite(v)) ranks.push(v)
      j++
    }

    if (ranks.length < 8) break

    const mathRank = ranks[4] // Overall, Expert, Hard, Coding, Math, ...
    if (Number.isFinite(mathRank)) {
      rows.push({ model: cleanedModel, mathRank })
    }
    i = j

    // Stop once we have enough candidates, avoid scanning the entire page.
    if (rows.length > 400) break
  }

  return rows
    .sort((a, b) => a.mathRank - b.mathRank)
    .slice(0, 10)
    .map((r, idx) => ({
      rank: idx + 1,
      model_raw: r.model,
      score: null,
      score_label: 'Rank',
      metadata: { arena_math_rank: r.mathRank },
    }))
}

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
  })
  if (!res.ok) {
    const body = await res.text()
    const err = new Error(`Fetch failed (${res.status}) for ${url}: ${body.slice(0, 200)}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return await res.text()
}

export async function fetchArenaDomainTop(domain: ModelDomain): Promise<{
  domain: ModelDomain
  candidates: RankingCandidate[]
  sourceName: string
  sourceUrl: string
}> {
  if (domain === 'audio') {
    return {
      domain,
      candidates: [],
      sourceName: 'Arena',
      sourceUrl: ARENA_BASE,
    }
  }

  if (domain === 'math') {
    const sourceUrl = `${ARENA_BASE}`
    const html = await fetchHTML(sourceUrl)
    return {
      domain,
      candidates: parseArenaOverviewHTMLForMath(html),
      sourceName: 'Arena Overview',
      sourceUrl,
    }
  }

  const pathByDomain: Record<Exclude<ModelDomain, 'math' | 'audio'>, string> = {
    coding: '/code',
    text: '/text',
    image: '/text-to-image',
    video: '/text-to-video',
  }

  const sourceUrl = `${ARENA_BASE}${pathByDomain[domain as Exclude<ModelDomain, 'math' | 'audio'>]}`
  const html = await fetchHTML(sourceUrl)
  return {
    domain,
    candidates: parseArenaLeaderboardHTML(html, 'Elo'),
    sourceName: 'Arena',
    sourceUrl,
  }
}
