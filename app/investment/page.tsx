import { createPublicClient } from '@/lib/supabase'
import InvestmentClient from './InvestmentClient'
import type { EnrichedInvestmentEvent } from '@/lib/types'

export const revalidate = 300 // 5 minutes

async function getInvestmentEvents(): Promise<EnrichedInvestmentEvent[]> {
  const supabase = createPublicClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('enriched_investment_events')
    .select('*')
    .gte('event_processed_at', since)
    .order('event_processed_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[Investment] Failed to fetch investment events:', error)
    return []
  }

  return data || []
}

export default async function InvestmentPage() {
  const events = await getInvestmentEvents()
  return <InvestmentClient initialEvents={events} />
}

