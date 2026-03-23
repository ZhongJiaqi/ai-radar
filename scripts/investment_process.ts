// scripts/investment_process.ts — Extract AI industry-chain investment events from processed articles
import 'dotenv/config'

import { processInvestmentEvents } from '../lib/processor/investment'

async function main() {
  const batchSize = parseInt(process.env.BATCH_SIZE || '30', 10)
  const sinceDays = parseInt(process.env.SINCE_DAYS || '30', 10)
  console.log(`[Investment] Starting (batch size: ${batchSize}, sinceDays: ${sinceDays})...`)

  const result = await processInvestmentEvents(batchSize, sinceDays)
  const total = result.processed + result.failed
  const successRate = total > 0 ? Math.round((result.processed / total) * 100) : 100

  console.log(`[Investment] Done: ${result.processed} processed, ${result.skipped} skipped, ${result.failed} failed (${successRate}% success rate)`)
  if (successRate < 70 && result.failed > 5) process.exit(1)
  process.exit(0)
}

main().catch(err => {
  console.error('[Investment] Fatal error:', err)
  process.exit(1)
})

