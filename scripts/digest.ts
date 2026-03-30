// scripts/digest.ts — Standalone daily digest script for GitHub Actions
import 'dotenv/config'
import { generateDailyDigest } from '../lib/processor/digest'
import { getTodayCN } from '../lib/utils/time'

async function main() {
  const date = process.argv[2] || getTodayCN()
  console.log(`[Digest] Generating for ${date}...`)
  const md = await generateDailyDigest(date)
  console.log(`[Digest] Done (${md.length} chars)`)
  process.exit(0)
}

main().catch(err => {
  console.error('[Digest] Fatal error:', err)
  process.exit(1)
})
