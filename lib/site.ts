export function getSiteUrl(): string {
  // Preferred explicit config (set this in Vercel project env if you have your own domain)
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL

  const normalize = (raw: string): string => {
    const trimmed = raw.trim().replace(/\/+$/, '')
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  const fromExplicit = explicit ? normalize(explicit) : ''
  if (fromExplicit) return fromExplicit

  // Vercel provides this automatically (no scheme).
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`

  // Local dev fallback.
  return 'http://localhost:3000'
}

