import type { ModelRegistryRow } from './types'

export function normalizeModelAlias(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function slugifyModelKey(raw: string): string {
  const normalized = normalizeModelAlias(raw)
  return normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown'
}

const KNOWN_VENDOR_PREFIXES = new Set([
  'anthropic',
  'openai',
  'google',
  'deepmind',
  'meta',
  'mistral',
  'xai',
  'qwen',
  'alibaba',
  'minimax',
  'deepseek',
  'cohere',
])

export function stripVendorPrefix(raw: string): { vendor: string | null; model: string } {
  const s = String(raw || '').trim().replace(/\s+/g, ' ')
  const first = s.split(' ')[0]?.toLowerCase()
  if (!first) return { vendor: null, model: '' }
  if (KNOWN_VENDOR_PREFIXES.has(first) && s.includes(' ')) {
    return { vendor: s.split(' ')[0], model: s.split(' ').slice(1).join(' ').trim() }
  }
  return { vendor: null, model: s }
}

export function buildRegistryLookup(registry: ModelRegistryRow[]) {
  const aliasToKey = new Map<string, string>()
  const keyToRow = new Map<string, ModelRegistryRow>()

  for (const row of registry) {
    if (!row.is_active) continue
    keyToRow.set(row.model_key, row)

    const candidates = new Set<string>()
    candidates.add(row.display_name)
    for (const a of row.aliases || []) candidates.add(String(a))
    candidates.add(row.model_key)

    for (const c of candidates) {
      const norm = normalizeModelAlias(c)
      if (!norm) continue
      if (!aliasToKey.has(norm)) aliasToKey.set(norm, row.model_key)
    }
  }

  return { aliasToKey, keyToRow }
}

