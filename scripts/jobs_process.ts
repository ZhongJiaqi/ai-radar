// scripts/jobs_process.ts — Process raw job posts with LLM
import 'dotenv/config'

import { createServiceClient } from '../lib/supabase'
import { computeHotScore, processJobPost } from '../lib/processor/jobs'
import { HAIKU_MODEL } from '../lib/claude'

async function main() {
  const batchSize = parseInt(process.env.BATCH_SIZE || '30', 10)
  console.log(`[Jobs:Process] Starting (batch size: ${batchSize})...`)

  const supabase = createServiceClient()
  const { data: posts, error } = await supabase
    .from('job_posts')
    .select('id, title, raw_text, url, source_name, posted_at, metrics, process_attempts, skip_reason')
    .eq('is_processed', false)
    .is('skip_reason', null)
    .lt('process_attempts', 3)
    .order('posted_at', { ascending: false })
    .order('crawled_at', { ascending: false })
    .limit(batchSize)

  if (error) throw new Error(`Fetch job_posts failed: ${error.message}`)
  if (!posts || posts.length === 0) {
    console.log('[Jobs:Process] No pending job posts.')
    process.exit(0)
  }

  let processed = 0
  let failed = 0

  for (const p of posts) {
    try {
      const rawText = (p.raw_text || p.title || '').toString()
      const metrics = (p.metrics && typeof p.metrics === 'object') ? p.metrics : {}
      const llm = await processJobPost({
        title: p.title,
        raw_text: rawText,
        source_name: p.source_name || 'unknown',
        url: p.url,
        posted_at: p.posted_at,
        metrics,
      })

      const hotScore = computeHotScore({ posted_at: p.posted_at, metrics })

      const { error: insertError } = await supabase
        .from('processed_job_posts')
        .upsert({
          job_post_id: p.id,
          summary_zh: llm.summary_zh,
          company: llm.company,
          role_title: llm.role_title,
          location: llm.location,
          remote: llm.remote,
          seniority: llm.seniority,
          ai_domain: llm.ai_domain,
          tags: llm.tags,
          hot_score: hotScore,
          why_it_hot: llm.why_it_hot,
          model_used: HAIKU_MODEL,
        }, { onConflict: 'job_post_id' })

      if (insertError) throw new Error(`Upsert processed_job_posts failed: ${insertError.message}`)

      await supabase.from('job_posts').update({ is_processed: true }).eq('id', p.id)
      processed++
      await new Promise(r => setTimeout(r, 250))
    } catch (err) {
      console.error('[Jobs:Process] Failed for job_post', p.id, err)
      const attempts = (p.process_attempts || 0) + 1
      const update: Record<string, unknown> = {
        process_attempts: attempts,
        last_error: String(err).slice(0, 500),
      }
      if (attempts >= 3) {
        update.skip_reason = `Failed after ${attempts} attempts: ${String(err).slice(0, 200)}`
      }
      await supabase.from('job_posts').update(update).eq('id', p.id)
      failed++
    }
  }

  const total = processed + failed
  const successRate = total > 0 ? Math.round((processed / total) * 100) : 100
  console.log(`[Jobs:Process] Done: ${processed} processed, ${failed} failed (${successRate}% success rate)`)

  if (successRate < 70 && failed > 5) process.exit(1)
  process.exit(0)
}

main().catch(err => {
  console.error('[Jobs:Process] Fatal:', err)
  process.exit(1)
})

