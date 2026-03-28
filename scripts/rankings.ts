// scripts/rankings.ts — Standalone rankings ingestion script for GitHub Actions
import 'dotenv/config'
import { updateModelRankings } from '../lib/rankings'

async function main() {
  console.log('[Rankings] Starting...')
  const result = await updateModelRankings()
  console.log(`[Rankings] Done: ${result.updated} updated, ${result.failed} failed`)
  // If every source fails, treat it as a workflow failure.
  if (result.updated === 0 && result.failed > 0) process.exit(1)
  process.exit(0)
}

main().catch(err => {
  console.error('[Rankings] Fatal error:', err)
  process.exit(1)
})

