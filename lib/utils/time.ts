// lib/utils/time.ts — Beijing time (UTC+8) helpers

const CN_OFFSET = 8 * 60 * 60 * 1000

/**
 * Given a date string (YYYY-MM-DD), returns that day's 00:00~24:00 range
 * in Beijing time as UTC ISO strings.
 */
export function getDateRangeCN(dateStr: string): { since: string; until: string; dateStr: string } {
  // Parse as Beijing time date
  const [y, m, d] = dateStr.split('-').map(Number)
  // dateStr 00:00 Beijing time → UTC
  const startUTC = new Date(Date.UTC(y, m - 1, d) - CN_OFFSET)
  // next day 00:00 Beijing time → UTC
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000)

  return {
    since: startUTC.toISOString(),
    until: endUTC.toISOString(),
    dateStr,
  }
}

/**
 * Returns yesterday's date range in Beijing time (00:00 ~ 24:00) as UTC ISO strings.
 */
export function getYesterdayRangeCN(): { since: string; until: string; dateStr: string } {
  const now = new Date()
  const cnNow = new Date(now.getTime() + CN_OFFSET)
  const y = cnNow.getUTCFullYear()
  const m = String(cnNow.getUTCMonth() + 1).padStart(2, '0')
  const d = String(cnNow.getUTCDate()).padStart(2, '0')
  // "Yesterday" in Beijing time
  const todayStr = `${y}-${m}-${d}`
  const todayStart = new Date(Date.UTC(cnNow.getUTCFullYear(), cnNow.getUTCMonth(), cnNow.getUTCDate()) - CN_OFFSET)
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
  const cnYesterday = new Date(yesterdayStart.getTime() + CN_OFFSET)
  const yy = cnYesterday.getUTCFullYear()
  const mm = String(cnYesterday.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(cnYesterday.getUTCDate()).padStart(2, '0')

  return getDateRangeCN(`${yy}-${mm}-${dd}`)
}
