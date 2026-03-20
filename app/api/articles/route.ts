import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase'
import type { ContentCategory } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createPublicClient()
  const { searchParams } = req.nextUrl

  const category = searchParams.get('category') as ContentCategory | null
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const minScore = parseInt(searchParams.get('min_score') || '1')
  const hours = parseInt(searchParams.get('hours') || '24')

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('enriched_articles')
    .select('*')
    .gte('importance_score', minScore)
    .order('importance_score', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit)

  // Filter by time window
  query = query.or(`published_at.gte.${since},crawled_at.gte.${since}`)

  if (category) {
    query = query.eq('content_category', category)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ articles: data, count: data?.length || 0 })
}
