import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createPublicClient()
  const dateParam = req.nextUrl.searchParams.get('date')
  const date = dateParam || format(new Date(), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('daily_digests')
    .select('*')
    .eq('date', date)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Digest not found for date: ' + date }, { status: 404 })
  }

  return NextResponse.json({ digest: data })
}

// List recent digests
export async function POST(_req: NextRequest) {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('daily_digests')
    .select('id, date, stats, generated_at')
    .order('date', { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ digests: data })
}
