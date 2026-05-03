// scripts/process.ts — Standalone LLM processing script for GitHub Actions
import 'dotenv/config'
import { processUnprocessedArticles, reprocessFallbackArticles } from '../lib/processor/llm'

async function main() {
  const batchSize = parseInt(process.env.BATCH_SIZE || '50', 10)
  const reprocessSize = parseInt(process.env.REPROCESS_BATCH_SIZE || '50', 10)

  console.log(`[Process] Starting new-article pass (batch size: ${batchSize})...`)
  const result = await processUnprocessedArticles(batchSize)
  const total = result.processed + result.failed
  const successRate = total > 0 ? Math.round((result.processed / total) * 100) : 100
  console.log(`[Process] Done: ${result.processed} processed, ${result.failed} failed (${successRate}% success rate)`)

  console.log(`[Reprocess] Starting fallback retry pass (batch size: ${reprocessSize})...`)
  const reprocessResult = await reprocessFallbackArticles(reprocessSize)
  console.log(`[Reprocess] Done: ${reprocessResult.reprocessed} reprocessed, ${reprocessResult.failed} failed`)

  // Only fail the workflow when both passes are completely broken.
  // Partial failures should not block database updates / site freshness.
  const allFailed =
    result.processed === 0 && result.failed > 0 &&
    reprocessResult.reprocessed === 0 && reprocessResult.failed > 0
  if (allFailed) process.exit(1)
  process.exit(0)
}

main().catch(err => {
  console.error('[Process] Fatal error:', err)
  process.exit(1)
})
