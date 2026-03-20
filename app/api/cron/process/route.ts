import { NextRequest, NextResponse } from 'next/server'
import { processUnprocessedArticles } from '@/lib/processor/llm'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[CRON] Starting LLM process job...')
    const result = await processUnprocessedArticles(20)
    console.log(`[CRON] Process complete: ${JSON.stringify(result)}`)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[CRON] Process failed:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    )
  }
}
