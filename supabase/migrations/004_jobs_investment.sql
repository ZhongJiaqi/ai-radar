-- ======================================================
-- AI Radar - Jobs + Investment modules (v1)
-- Adds tables/views for AI Jobs aggregation and AI Investment events extraction
-- ======================================================

-- ----------------------
-- AI Jobs: sources
-- ----------------------
CREATE TABLE IF NOT EXISTS job_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL, -- e.g. 'hn-whoishiring', 'xhs-ai-jobs'
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('hn', 'xhs', 'links', 'rss', 'api', 'scraper')),
  url           TEXT,
  priority      INTEGER NOT NULL DEFAULT 5,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_crawled_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------
-- AI Jobs: raw posts
-- ----------------------
CREATE TABLE IF NOT EXISTS job_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_slug    TEXT NOT NULL,
  source_name    TEXT NOT NULL,
  external_id    TEXT,              -- platform-native id (HN comment id, XHS feed id, etc.)
  url            TEXT UNIQUE NOT NULL,
  title          TEXT NOT NULL,
  raw_text       TEXT,              -- original post text (best-effort)
  metrics        JSONB NOT NULL DEFAULT '{}', -- likes/comments/etc (platform specific)
  posted_at      TIMESTAMPTZ,
  crawled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  normalized_hash TEXT,

  -- processing bookkeeping (similar to articles)
  is_processed   BOOLEAN NOT NULL DEFAULT false,
  process_attempts INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT,
  skip_reason    TEXT
);

CREATE INDEX IF NOT EXISTS job_posts_posted_at_idx       ON job_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS job_posts_crawled_at_idx      ON job_posts(crawled_at DESC);
CREATE INDEX IF NOT EXISTS job_posts_is_processed_idx    ON job_posts(is_processed);
CREATE INDEX IF NOT EXISTS job_posts_source_slug_idx     ON job_posts(source_slug);
CREATE INDEX IF NOT EXISTS job_posts_title_hash_idx      ON job_posts(normalized_hash);

-- ----------------------
-- AI Jobs: processed posts (LLM)
-- ----------------------
CREATE TABLE IF NOT EXISTS processed_job_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id    UUID REFERENCES job_posts(id) ON DELETE CASCADE UNIQUE NOT NULL,
  summary_zh     TEXT NOT NULL,
  company        TEXT,
  role_title     TEXT,
  location       TEXT,
  remote         TEXT, -- 'remote' | 'onsite' | 'hybrid' | null
  seniority      TEXT,
  ai_domain      TEXT,
  tags           TEXT[] NOT NULL DEFAULT '{}',
  hot_score      INTEGER NOT NULL CHECK (hot_score BETWEEN 1 AND 10),
  why_it_hot     TEXT,
  model_used     TEXT NOT NULL,
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS processed_job_posts_hot_idx   ON processed_job_posts(hot_score DESC);
CREATE INDEX IF NOT EXISTS processed_job_posts_tags_gin  ON processed_job_posts USING GIN(tags);
CREATE INDEX IF NOT EXISTS processed_job_posts_company_idx ON processed_job_posts(company);

-- View: enriched_job_posts
CREATE OR REPLACE VIEW enriched_job_posts AS
SELECT
  jp.id,
  jp.source_slug,
  jp.source_name,
  jp.external_id,
  jp.url,
  jp.title,
  jp.raw_text,
  jp.metrics,
  jp.posted_at,
  jp.crawled_at,
  p.summary_zh,
  p.company,
  p.role_title,
  p.location,
  p.remote,
  p.seniority,
  p.ai_domain,
  p.tags,
  p.hot_score,
  p.why_it_hot,
  p.model_used,
  p.processed_at
FROM job_posts jp
JOIN processed_job_posts p ON p.job_post_id = jp.id
ORDER BY p.hot_score DESC, COALESCE(jp.posted_at, jp.crawled_at) DESC;

-- ----------------------
-- AI Investment: extracted events from enriched_articles
-- ----------------------
CREATE TABLE IF NOT EXISTS investment_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id     UUID REFERENCES articles(id) ON DELETE CASCADE UNIQUE NOT NULL,

  company        TEXT,
  event_type     TEXT,               -- financing | m&a | capex | ipo | other
  round          TEXT,
  amount_text    TEXT,               -- keep original string to avoid fragile numeric parsing
  currency       TEXT,               -- CNY | USD | ...
  investors      TEXT[] NOT NULL DEFAULT '{}',

  sector_major   TEXT NOT NULL,      -- 6 major buckets (see lib/investment/taxonomy.ts)
  sector_detail  TEXT,
  region         TEXT,
  is_public      BOOLEAN,
  tickers        TEXT[] NOT NULL DEFAULT '{}',

  summary_zh     TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  model_used     TEXT NOT NULL,
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS investment_events_processed_at_idx ON investment_events(processed_at DESC);
CREATE INDEX IF NOT EXISTS investment_events_sector_major_idx ON investment_events(sector_major);
CREATE INDEX IF NOT EXISTS investment_events_investors_gin    ON investment_events USING GIN(investors);
CREATE INDEX IF NOT EXISTS investment_events_tickers_gin      ON investment_events USING GIN(tickers);

-- View: enriched_investment_events
CREATE OR REPLACE VIEW enriched_investment_events AS
SELECT
  a.id            AS article_id,
  a.source_slug,
  a.source_name,
  a.title         AS article_title,
  a.url           AS article_url,
  a.author,
  a.published_at,
  a.crawled_at,
  pa.category     AS content_category,
  pa.importance_score,
  pa.tags         AS article_tags,
  pa.summary_zh   AS article_summary_zh,
  pa.why_it_matters AS article_why_it_matters,
  pa.processed_at AS article_processed_at,

  ie.id           AS event_id,
  ie.company,
  ie.event_type,
  ie.round,
  ie.amount_text,
  ie.currency,
  ie.investors,
  ie.sector_major,
  ie.sector_detail,
  ie.region,
  ie.is_public,
  ie.tickers,
  ie.summary_zh   AS event_summary_zh,
  ie.why_it_matters AS event_why_it_matters,
  ie.model_used,
  ie.processed_at AS event_processed_at
FROM articles a
JOIN processed_articles pa ON pa.article_id = a.id
JOIN investment_events ie ON ie.article_id = a.id
ORDER BY ie.processed_at DESC;

-- ----------------------
-- RLS: public read, service-role write (match existing style)
-- ----------------------
ALTER TABLE job_sources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_job_posts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_events    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_job_sources"         ON job_sources;
DROP POLICY IF EXISTS "public_read_job_posts"           ON job_posts;
DROP POLICY IF EXISTS "public_read_processed_job_posts" ON processed_job_posts;
DROP POLICY IF EXISTS "public_read_investment_events"   ON investment_events;

DROP POLICY IF EXISTS "service_write_job_sources"         ON job_sources;
DROP POLICY IF EXISTS "service_write_job_posts"           ON job_posts;
DROP POLICY IF EXISTS "service_write_processed_job_posts" ON processed_job_posts;
DROP POLICY IF EXISTS "service_write_investment_events"   ON investment_events;

CREATE POLICY "public_read_job_sources"         ON job_sources         FOR SELECT USING (true);
CREATE POLICY "public_read_job_posts"           ON job_posts           FOR SELECT USING (true);
CREATE POLICY "public_read_processed_job_posts" ON processed_job_posts FOR SELECT USING (true);
CREATE POLICY "public_read_investment_events"   ON investment_events   FOR SELECT USING (true);

CREATE POLICY "service_write_job_sources"         ON job_sources         FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_write_job_posts"           ON job_posts           FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_write_processed_job_posts" ON processed_job_posts FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_write_investment_events"   ON investment_events   FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
