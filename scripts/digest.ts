// scripts/digest.ts — Standalone daily digest script for GitHub Actions
import 'dotenv/config'
import { format } from 'date-fns'
import { generateDailyDigest } from '../lib/processor/digest'

async function main() {
  const date = process.argv[2] || format(new Date(), 'yyyy-MM-dd')
  console.log(`[Digest] Generating for ${date}...`)
  const md = await generateDailyDigest(date)
  console.log(`[Digest] Done (${md.length} chars)`)
  process.exit(0)
}

main().catch(err => {
  console.error('[Digest] Fatal error:', err)
  process.exit(1)
})
