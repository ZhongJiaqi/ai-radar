// ======================================================
// AI Radar - Global TypeScript Types
// ======================================================

export type SourceType = 'rss' | 'api' | 'scraper' | 'twitter' | 'youtube'
export type SourceCategory = 'official' | 'community' | 'person' | 'media'

export type ContentCategory =
  | 'model_release'
  | 'product_tool'
  | 'research_paper'
  | 'industry_news'
  | 'funding_ma'
  | 'policy_regulation'
  | 'open_source'
  | 'opinion_insight'

export const CONTENT_CATEGORIES: ContentCategory[] = [
  'model_release', 'product_tool', 'research_paper',
  'industry_news', 'funding_ma', 'policy_regulation',
  'open_source', 'opinion_insight',
]

// ---- Database row types ----

export interface Source {
  id: string
  slug: string
  name: string
  type: SourceType
  category: SourceCategory
  url: string
  home_url?: string
  is_active: boolean
  priority: number
  last_crawled_at?: string
  created_at: string
}

export interface Article {
  id: string
  source_id?: string
  source_slug: string
  source_name: string
  title: string
  url: string
  content?: string
  author?: string
  published_at?: string
  crawled_at: string
  is_processed: boolean
}

export interface ProcessedArticle {
  id: string
  article_id: string
  summary_zh: string
  category: ContentCategory
  tags: string[]
  importance_score: number
  why_it_matters: string
  model_used: string
  processed_at: string
}

export interface DailyDigest {
  id: string
  date: string
  content_md: string
  top_article_ids: string[]
  stats: DigestStats
  generated_at: string
}

export interface DigestStats {
  total: number
  by_category: Record<string, number>
  avg_importance: number
}

// ---- Enriched view (joined) ----

export interface EnrichedArticle {
  id: string
  source_slug: string
  source_name: string
  title: string
  url: string
  author?: string
  published_at?: string
  crawled_at: string
  source_category: SourceCategory
  source_priority: number
  summary_zh: string
  content_category: ContentCategory
  tags: string[]
  importance_score: number
  why_it_matters: string
  processed_at: string
}

// ---- Crawler raw output ----

export interface RawArticle {
  source_slug: string
  source_name: string
  title: string
  url: string
  content?: string
  author?: string
  published_at?: Date
}

// ---- LLM processor output ----

export interface LLMResult {
  summary_zh: string
  category: ContentCategory
  tags: string[]
  importance_score: number
  why_it_matters: string
}

// ======================================================
// AI Jobs
// ======================================================

export type JobSourceType = 'hn' | 'xhs' | 'links' | 'rss' | 'api' | 'scraper'

export interface JobSource {
  id: string
  slug: string
  name: string
  type: JobSourceType
  url?: string
  priority: number
  is_active: boolean
  last_crawled_at?: string
  created_at: string
}

export interface JobPost {
  id: string
  source_slug: string
  source_name: string
  external_id?: string | null
  url: string
  title: string
  raw_text?: string | null
  metrics: Record<string, unknown>
  posted_at?: string | null
  crawled_at: string
  normalized_hash?: string | null
  is_processed: boolean
  process_attempts: number
  last_error?: string | null
  skip_reason?: string | null
}

export interface ProcessedJobPost {
  id: string
  job_post_id: string
  summary_zh: string
  company?: string | null
  role_title?: string | null
  location?: string | null
  remote?: string | null
  seniority?: string | null
  ai_domain?: string | null
  tags: string[]
  hot_score: number
  why_it_hot?: string | null
  model_used: string
  processed_at: string
}

export interface EnrichedJobPost {
  id: string
  source_slug: string
  source_name: string
  external_id?: string | null
  url: string
  title: string
  raw_text?: string | null
  metrics: Record<string, unknown>
  posted_at?: string | null
  crawled_at: string
  summary_zh: string
  company?: string | null
  role_title?: string | null
  location?: string | null
  remote?: string | null
  seniority?: string | null
  ai_domain?: string | null
  tags: string[]
  hot_score: number
  why_it_hot?: string | null
  model_used: string
  processed_at: string
}

// ======================================================
// AI Investment
// ======================================================

export interface InvestmentEvent {
  id: string
  article_id: string
  company?: string | null
  event_type?: string | null
  round?: string | null
  amount_text?: string | null
  currency?: string | null
  investors: string[]
  sector_major: string
  sector_detail?: string | null
  region?: string | null
  is_public?: boolean | null
  tickers: string[]
  summary_zh: string
  why_it_matters: string
  model_used: string
  processed_at: string
}

export interface EnrichedInvestmentEvent {
  article_id: string
  source_slug: string
  source_name: string
  article_title: string
  article_url: string
  author?: string | null
  published_at?: string | null
  crawled_at: string
  content_category: ContentCategory
  importance_score: number
  article_tags: string[]
  article_summary_zh: string
  article_why_it_matters: string
  article_processed_at: string
  event_id: string
  company?: string | null
  event_type?: string | null
  round?: string | null
  amount_text?: string | null
  currency?: string | null
  investors: string[]
  sector_major: string
  sector_detail?: string | null
  region?: string | null
  is_public?: boolean | null
  tickers: string[]
  event_summary_zh: string
  event_why_it_matters: string
  model_used: string
  event_processed_at: string
}

// ---- Source config (static) ----

export interface SourceConfig {
  slug: string
  name: string
  type: SourceType
  category: SourceCategory
  url: string
  home_url?: string
  priority: number
  // For twitter
  twitter_username?: string
}
