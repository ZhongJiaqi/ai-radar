// scripts/cleanup.ts — Retention cleanup for AI News
// Runs weekly via .github/workflows/cleanup.yml
//
// Defaults (override via env):
//   ARTICLE_RETENTION_DAYS=90    deletes articles + cascades processed_articles
//   JOB_RUNS_RETENTION_DAYS=30   keeps recent ops history only
//
// Tables kept indefinitely: sources, source_health, daily_digests,
// model_registry, model_rankings — all small or product-history valuable.

import 'dotenv/config'
import { createServiceClient } from '../lib/supabase'

const ARTICLE_RETENTION_DAYS = parseInt(
  process.env.ARTICLE_RETENTION_DAYS || '90',
  10,
)
const JOB_RUNS_RETENTION_DAYS = parseInt(
  process.env.JOB_RUNS_RETENTION_DAYS || '30',
  10,
)

function cutoffISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

async function deleteOlderThan(
  table: string,
  column: string,
  cutoff: string,
): Promise<number> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(table)
    .delete()
    .lt(column, cutoff)
    .select('id')

  if (error) throw new Error(`Delete from ${table} failed: ${error.message}`)
  return data?.length ?? 0
}

async function main(): Promise<void> {
  const articleCutoff = cutoffISO(ARTICLE_RETENTION_DAYS)
  const jobCutoff = cutoffISO(JOB_RUNS_RETENTION_DAYS)

  console.log(`[Cleanup] articles older than ${ARTICLE_RETENTION_DAYS}d (< ${articleCutoff})`)
  const articlesDeleted = await deleteOlderThan('articles', 'crawled_at', articleCutoff)
  console.log(`[Cleanup] deleted ${articlesDeleted} articles (processed_articles cascade via FK)`)

  console.log(`[Cleanup] job_runs older than ${JOB_RUNS_RETENTION_DAYS}d (< ${jobCutoff})`)
  const jobsDeleted = await deleteOlderThan('job_runs', 'started_at', jobCutoff)
  console.log(`[Cleanup] deleted ${jobsDeleted} job_runs`)

  console.log(
    `[Cleanup] Done: ${articlesDeleted} articles, ${jobsDeleted} job_runs removed`,
  )
}

main().catch((err) => {
  console.error('[Cleanup] Fatal error:', err)
  process.exit(1)
})
