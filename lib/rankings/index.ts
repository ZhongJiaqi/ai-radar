import { createServiceClient } from '../supabase'
import type { ModelDomain, ModelRegistryRow, ModelRankingRow, RankingCandidate } from './types'
import { buildRegistryLookup, normalizeModelAlias, slugifyModelKey } from './normalize'
import { fetchArenaDomainTop } from './sources/arena'

const DOMAINS: ModelDomain[] = ['coding', 'math', 'text', 'image', 'video', 'audio']

type JobStatus = 'running' | 'success' | 'failed'

const toErrText = (err: unknown): string => {
  if (err && typeof err === 'object') {
    const anyErr = err as any
    if (typeof anyErr.message === 'string') return anyErr.message
  }
  return String(err)
}

async function finishJob(supabase: any, jobId: string | undefined, status: JobStatus, success: number, fail: number, error?: string) {
  if (!jobId) return
  try {
    await supabase.from('job_runs').update({
      status,
      finished_at: new Date().toISOString(),
      success_count: success,
      fail_count: fail,
      error_message: error || null,
    }).eq('id', jobId)
  } catch {
    // don't break pipeline on telemetry
  }
}

async function loadRegistry(supabase: any): Promise<ModelRegistryRow[]> {
  const { data, error } = await supabase
    .from('model_registry')
    .select('*')
    .eq('is_active', true)
    .limit(2000)
  if (error) throw new Error(`Load model_registry failed: ${error.message}`)
  return (data || []) as ModelRegistryRow[]
}

async function ensureModelExists(
  supabase: any,
  lookup: ReturnType<typeof buildRegistryLookup>,
  rawModel: string,
  vendor?: string
): Promise<{ modelKey: string; displayName: string }> {
  const alias = normalizeModelAlias(rawModel)
  const existingKey = lookup.aliasToKey.get(alias)
  if (existingKey) {
    const row = lookup.keyToRow.get(existingKey)
    return { modelKey: existingKey, displayName: row?.display_name || rawModel }
  }

  const modelKey = slugifyModelKey(alias)
  const displayName = String(rawModel || '').trim().slice(0, 120) || modelKey

  const insert = {
    model_key: modelKey,
    display_name: displayName,
    vendor: vendor || null,
    aliases: [rawModel, displayName].filter(Boolean),
    is_active: true,
    is_auto: true,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('model_registry')
    .upsert(insert, { onConflict: 'model_key' })

  if (error) {
    throw new Error(`Upsert model_registry failed (${modelKey}): ${error.message}`)
  }

  // Update in-memory lookup so the same run is consistent.
  lookup.aliasToKey.set(alias, modelKey)
  lookup.keyToRow.set(modelKey, {
    model_key: modelKey,
    display_name: displayName,
    vendor: vendor || null,
    aliases: insert.aliases,
    is_active: true,
    is_auto: true,
    created_at: new Date().toISOString(),
    updated_at: insert.updated_at,
  })

  return { modelKey, displayName }
}

function topN(candidates: RankingCandidate[], n: number): RankingCandidate[] {
  return [...candidates].sort((a, b) => a.rank - b.rank).slice(0, n)
}

export async function updateModelRankings(): Promise<{ updated: number; failed: number }> {
  const supabase = createServiceClient()

  const { data: job } = await supabase
    .from('job_runs')
    .insert({ job_type: 'rankings', status: 'running' })
    .select('id')
    .single()
  const jobId = job?.id as string | undefined

  let updated = 0
  let failed = 0
  const capturedAt = new Date().toISOString()

  try {
    const registry = await loadRegistry(supabase)
    const lookup = buildRegistryLookup(registry)

    const results = await Promise.allSettled(
      DOMAINS.map(d => fetchArenaDomainTop(d))
    )

    const upserts: Array<{
      domain: ModelDomain
      rank: number
      model_key: string
      model_name: string
      score: number | null
      score_label: string | null
      source_name: string
      source_url: string
      captured_at: string
      metadata: Record<string, unknown>
    }> = []

    for (const r of results) {
      if (r.status === 'rejected') {
        failed++
        console.warn('[Rankings] Source failed:', toErrText(r.reason))
        continue
      }

      const domain = r.value.domain
      const sourceName = r.value.sourceName
      const sourceUrl = r.value.sourceUrl

      const candidates = topN(r.value.candidates, 3)
      for (const c of candidates) {
        const ensured = await ensureModelExists(supabase, lookup, c.model_raw, c.vendor)
        upserts.push({
          domain,
          rank: c.rank,
          model_key: ensured.modelKey,
          model_name: ensured.displayName,
          score: c.score,
          score_label: c.score_label,
          source_name: sourceName,
          source_url: sourceUrl,
          captured_at: capturedAt,
          metadata: {
            ...(c.metadata || {}),
            vendor: c.vendor || null,
            model_raw: c.model_raw,
          },
        })
      }
    }

    if (upserts.length === 0) {
      await finishJob(supabase, jobId, failed > 0 ? 'failed' : 'success', 0, failed, failed > 0 ? 'All sources failed' : undefined)
      return { updated: 0, failed }
    }

    const { error } = await supabase
      .from('model_rankings')
      .upsert(upserts, { onConflict: 'domain,rank' })

    if (error) {
      await finishJob(supabase, jobId, 'failed', 0, upserts.length, error.message)
      throw new Error(`Upsert model_rankings failed: ${error.message}`)
    }

    updated = upserts.length
    await finishJob(supabase, jobId, failed > 0 ? 'success' : 'success', updated, failed)
    return { updated, failed }
  } catch (err) {
    await finishJob(supabase, jobId, 'failed', updated, failed + 1, toErrText(err))
    throw err
  }
}
