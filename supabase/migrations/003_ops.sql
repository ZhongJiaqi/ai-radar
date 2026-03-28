-- ======================================================
-- AI Radar - Schema Upgrade: Ops & Data Quality
-- Title dedup, error tracking, source health, job runs
-- ======================================================

-- 1. Articles: add dedup + error tracking fields
ALTER TABLE articles ADD COLUMN IF NOT EXISTS normalized_title_hash TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS process_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS skip_reason TEXT;

CREATE INDEX IF NOT EXISTS articles_title_hash_idx ON articles(normalized_title_hash);

-- 2. Job runs: track each crawl/process/digest execution
CREATE TABLE IF NOT EXISTS job_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type    TEXT NOT NULL CHECK (job_type IN ('crawl', 'process', 'digest')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')) DEFAULT 'running',
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count    INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata      JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS job_runs_type_idx ON job_runs(job_type, started_at DESC);

-- 3. Source health: per-source reliability tracking
CREATE TABLE IF NOT EXISTS source_health (
  source_slug    TEXT PRIMARY KEY,
  total_runs     INTEGER NOT NULL DEFAULT 0,
  success_runs   INTEGER NOT NULL DEFAULT 0,
  last_success   TIMESTAMPTZ,
  last_failure   TIMESTAMPTZ,
  last_error     TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies for new tables (public read, service write)
ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_runs_public_read" ON job_runs;
DROP POLICY IF EXISTS "job_runs_service_write" ON job_runs;
CREATE POLICY "job_runs_public_read" ON job_runs FOR SELECT USING (true);
CREATE POLICY "job_runs_service_write" ON job_runs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "source_health_public_read" ON source_health;
DROP POLICY IF EXISTS "source_health_service_write" ON source_health;
CREATE POLICY "source_health_public_read" ON source_health FOR SELECT USING (true);
CREATE POLICY "source_health_service_write" ON source_health FOR ALL USING (true) WITH CHECK (true);
