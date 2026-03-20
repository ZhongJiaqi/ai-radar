import { NextRequest, NextResponse } from 'next/server'
import { runAllCrawlers } from '@/lib/crawlers'

export const maxDuration = 60 // Vercel Pro: 60s timeout

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel automatically sets this for cron jobs)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[CRON] Starting crawl job...')
    const result = await runAllCrawlers()
    console.log(`[CRON] Crawl complete: ${JSON.stringify(result)}`)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[CRON] Crawl failed:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    )
  }
}
