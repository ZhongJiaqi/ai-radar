// scripts/process.ts — Standalone LLM processing script for GitHub Actions
import 'dotenv/config'
import { processUnprocessedArticles } from '../lib/processor/llm'

async function main() {
  const batchSize = parseInt(process.env.BATCH_SIZE || '50', 10)
  console.log(`[Process] Starting (batch size: ${batchSize})...`)
  const result = await processUnprocessedArticles(batchSize)
  const total = result.processed + result.failed
  const successRate = total > 0 ? Math.round((result.processed / total) * 100) : 100
  console.log(`[Process] Done: ${result.processed} processed, ${result.failed} failed (${successRate}% success rate)`)
  if (successRate < 80 && result.failed > 5) process.exit(1)
  process.exit(0)
}

main().catch(err => {
  console.error('[Process] Fatal error:', err)
  process.exit(1)
})
