import { NextRequest, NextResponse } from 'next/server'
import { processUnprocessedArticles, reprocessFallbackArticles } from '@/lib/processor/llm'

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

    // Reprocess fallback articles (best-effort, after main processing)
    let reprocessResult = { reprocessed: 0, failed: 0 }
    try {
      reprocessResult = await reprocessFallbackArticles(10)
      console.log(`[CRON] Reprocess complete: ${JSON.stringify(reprocessResult)}`)
    } catch (err) {
      console.warn('[CRON] Reprocess failed (non-fatal):', err)
    }

    return NextResponse.json({
      success: true,
      ...result,
      reprocess: reprocessResult,
    })
  } catch (err) {
    console.error('[CRON] Process failed:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    )
  }
}
