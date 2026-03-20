// scripts/process.ts — Standalone LLM processing script for GitHub Actions
import 'dotenv/config'
import { processUnprocessedArticles } from '../lib/processor/llm'

async function main() {
  const batchSize = parseInt(process.env.BATCH_SIZE || '50', 10)
  console.log(`[Process] Starting (batch size: ${batchSize})...`)
  const result = await processUnprocessedArticles(batchSize)
  console.log(`[Process] Done: ${result.processed} processed, ${result.failed} failed`)
  if (result.failed > 0) process.exit(1)
  process.exit(0)
}

main().catch(err => {
  console.error('[Process] Fatal error:', err)
  process.exit(1)
})
