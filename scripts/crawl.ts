// scripts/crawl.ts — Standalone crawl script for GitHub Actions
import 'dotenv/config'
import { runAllCrawlers } from '../lib/crawlers'

async function main() {
  console.log('[Crawl] Starting...')
  const result = await runAllCrawlers()
  console.log(`[Crawl] Done: ${result.inserted} inserted, ${result.skipped} skipped`)
  process.exit(0)
}

main().catch(err => {
  console.error('[Crawl] Fatal error:', err)
  process.exit(1)
})
