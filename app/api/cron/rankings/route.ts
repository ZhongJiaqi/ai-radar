import { NextRequest, NextResponse } from 'next/server'
import { updateModelRankings } from '@/lib/rankings'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[CRON] Starting rankings job...')
    const result = await updateModelRankings()
    console.log(`[CRON] Rankings complete: ${JSON.stringify(result)}`)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[CRON] Rankings failed:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    )
  }
}

