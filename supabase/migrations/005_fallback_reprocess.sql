-- ======================================================
-- AI Radar - Schema Upgrade: Fallback Reprocess Support
-- Adds is_fallback flag to processed_articles for auto-retry
-- ======================================================

-- 1. Add fallback flag
ALTER TABLE processed_articles ADD COLUMN IF NOT EXISTS is_fallback BOOLEAN NOT NULL DEFAULT false;

-- 2. Mark existing fallback rows (those with heuristic why_it_matters)
UPDATE processed_articles
SET is_fallback = true
WHERE why_it_matters LIKE '%暂时无法获取 LLM 分析结果%';

-- 3. Add reprocess attempt tracking
ALTER TABLE processed_articles ADD COLUMN IF NOT EXISTS reprocess_attempts INTEGER NOT NULL DEFAULT 0;

-- 4. Index for efficient fallback queries
CREATE INDEX IF NOT EXISTS processed_articles_fallback_idx
  ON processed_articles(is_fallback) WHERE is_fallback = true;
