export type ModelDomain = 'coding' | 'math' | 'text' | 'video' | 'image' | 'audio'

export interface ModelRegistryRow {
  model_key: string
  display_name: string
  vendor: string | null
  aliases: string[]
  is_active: boolean
  is_auto: boolean
  created_at: string
  updated_at: string
}

export interface ModelRankingRow {
  id: string
  domain: ModelDomain
  rank: number
  model_key: string
  model_name: string
  score: number | null
  score_label: string | null
  source_name: string
  source_url: string
  captured_at: string
  metadata: Record<string, unknown>
}

export interface RankingCandidate {
  rank: number
  model_raw: string
  vendor?: string
  score: number | null
  score_label: string | null
  metadata?: Record<string, unknown>
}

