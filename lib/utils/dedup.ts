// lib/utils/dedup.ts — Title normalization for deduplication
import { createHash } from 'crypto'

// Common noise prefixes to strip
const NOISE_PREFIXES = [
  /^\[.*?\]\s*/,           // [Tag] ...
  /^(breaking|update|new|exclusive|watch|listen):\s*/i,
  /^(re|fw|fwd):\s*/i,
]

export function normalizeTitle(title: string): string {
  let t = title.toLowerCase().trim()
  for (const re of NOISE_PREFIXES) {
    t = t.replace(re, '')
  }
  // Collapse whitespace
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

export function titleHash(title: string): string {
  return createHash('sha256').update(normalizeTitle(title)).digest('hex').slice(0, 32)
}
