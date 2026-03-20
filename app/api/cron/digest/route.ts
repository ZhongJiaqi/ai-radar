import { NextRequest, NextResponse } from 'next/server'
import { generateDailyDigest } from '@/lib/processor/digest'
import { format } from 'date-fns'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Default to today; allow override via ?date=YYYY-MM-DD
  const dateParam = req.nextUrl.searchParams.get('date')
  const date = dateParam || format(new Date(), 'yyyy-MM-dd')

  try {
    console.log(`[CRON] Generating digest for ${date}...`)
    const md = await generateDailyDigest(date)
    console.log(`[CRON] Digest generated (${md.length} chars)`)
    return NextResponse.json({ success: true, date, length: md.length })
  } catch (err) {
    console.error('[CRON] Digest failed:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    )
  }
}
