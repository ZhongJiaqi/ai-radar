-- ======================================================
-- AI Radar - Supabase Database Schema
-- Run via: Supabase SQL Editor or supabase db push
-- ======================================================

-- ======================================================
-- SOURCES: 所有信源配置
-- ======================================================
CREATE TABLE IF NOT EXISTS sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,           -- e.g. 'openai-blog'
  name        TEXT NOT NULL,                  -- e.g. 'OpenAI Blog'
  type        TEXT NOT NULL CHECK (type IN ('rss', 'api', 'scraper', 'twitter')),
  category    TEXT NOT NULL CHECK (category IN ('official', 'community', 'person', 'media')),
  url         TEXT NOT NULL,                  -- feed/api/page URL
  home_url    TEXT,                           -- human-readable home page
  is_active   BOOLEAN NOT NULL DEFAULT true,
  priority    INTEGER NOT NULL DEFAULT 5,     -- 1-10, higher = more important
  last_crawled_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ======================================================
-- ARTICLES: 原始抓取内容
-- ======================================================
CREATE TABLE IF NOT EXISTS articles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    UUID REFERENCES sources(id) ON DELETE SET NULL,
  source_slug  TEXT NOT NULL,
  source_name  TEXT NOT NULL,
  title        TEXT NOT NULL,
  url          TEXT UNIQUE NOT NULL,
  content      TEXT,                          -- raw HTML or text content
  author       TEXT,
  published_at TIMESTAMPTZ,
  crawled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_processed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS articles_published_at_idx ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS articles_is_processed_idx ON articles(is_processed);
CREATE INDEX IF NOT EXISTS articles_source_slug_idx  ON articles(source_slug);

-- ======================================================
-- PROCESSED_ARTICLES: LLM 分析结果
-- ======================================================
CREATE TABLE IF NOT EXISTS processed_articles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id       UUID REFERENCES articles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  summary_zh       TEXT NOT NULL,             -- 中文摘要 (2-3句)
  category         TEXT NOT NULL CHECK (category IN (
                     '模型发布', '产品工具', '研究论文',
                     '行业动态', '融资并购', '政策监管',
                     '开源项目', '观点洞察'
                   )),
  tags             TEXT[] NOT NULL DEFAULT '{}',
  importance_score INTEGER NOT NULL CHECK (importance_score BETWEEN 1 AND 10),
  why_it_matters   TEXT NOT NULL,             -- 一句话核心洞察（中文）
  model_used       TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS processed_articles_category_idx       ON processed_articles(category);
CREATE INDEX IF NOT EXISTS processed_articles_importance_idx     ON processed_articles(importance_score DESC);

-- ======================================================
-- DAILY_DIGESTS: 每日简报
-- ======================================================
CREATE TABLE IF NOT EXISTS daily_digests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date             DATE UNIQUE NOT NULL,
  content_md       TEXT NOT NULL,             -- Markdown 格式简报
  top_article_ids  UUID[] NOT NULL DEFAULT '{}',
  stats            JSONB NOT NULL DEFAULT '{}', -- { total, by_category, avg_importance }
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ======================================================
-- VIEWS: 便于查询的视图
-- ======================================================
CREATE OR REPLACE VIEW enriched_articles AS
SELECT
  a.id,
  a.source_slug,
  a.source_name,
  a.title,
  a.url,
  a.author,
  a.published_at,
  a.crawled_at,
  s.category  AS source_category,
  s.priority  AS source_priority,
  pa.summary_zh,
  pa.category AS content_category,
  pa.tags,
  pa.importance_score,
  pa.why_it_matters,
  pa.processed_at
FROM articles a
JOIN processed_articles pa ON pa.article_id = a.id
JOIN sources s ON s.slug = a.source_slug
ORDER BY pa.importance_score DESC, a.published_at DESC;

-- ======================================================
-- RLS: Row Level Security (allow public read, service-role write)
-- ======================================================
ALTER TABLE sources            ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_digests      ENABLE ROW LEVEL SECURITY;

-- Public can read everything
CREATE POLICY "public_read_sources"    ON sources            FOR SELECT USING (true);
CREATE POLICY "public_read_articles"   ON articles           FOR SELECT USING (true);
CREATE POLICY "public_read_processed"  ON processed_articles FOR SELECT USING (true);
CREATE POLICY "public_read_digests"    ON daily_digests      FOR SELECT USING (true);

-- Only service role can write (enforced via SUPABASE_SERVICE_ROLE_KEY in API)
CREATE POLICY "service_write_sources"    ON sources            FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write_articles"   ON articles           FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write_processed"  ON processed_articles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write_digests"    ON daily_digests      FOR ALL USING (auth.role() = 'service_role');
