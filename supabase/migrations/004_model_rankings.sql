-- ======================================================
-- AI Radar - Model Rankings (public leaderboards)
-- Adds model registry + domain rankings + rankings job type
-- ======================================================

-- 0. Extend job_runs.job_type to include rankings
ALTER TABLE job_runs DROP CONSTRAINT IF EXISTS job_runs_job_type_check;
ALTER TABLE job_runs ADD CONSTRAINT job_runs_job_type_check
  CHECK (job_type IN ('crawl', 'process', 'digest', 'rankings'));

-- 1. Model registry: canonical keys + aliases
CREATE TABLE IF NOT EXISTS model_registry (
  model_key     TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  vendor        TEXT,
  aliases       TEXT[] NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_auto       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS model_registry_active_idx ON model_registry(is_active);

-- 2. Model rankings: current snapshot per domain + rank
CREATE TABLE IF NOT EXISTS model_rankings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        TEXT NOT NULL CHECK (domain IN ('coding', 'math', 'text', 'video', 'image', 'audio')),
  rank          INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 50),
  model_key     TEXT NOT NULL REFERENCES model_registry(model_key) ON DELETE RESTRICT,
  model_name    TEXT NOT NULL,
  score         DOUBLE PRECISION,
  score_label   TEXT,
  source_name   TEXT NOT NULL,
  source_url    TEXT NOT NULL,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata      JSONB NOT NULL DEFAULT '{}',
  UNIQUE(domain, rank)
);

CREATE INDEX IF NOT EXISTS model_rankings_domain_rank_idx ON model_rankings(domain, rank);
CREATE INDEX IF NOT EXISTS model_rankings_captured_idx ON model_rankings(captured_at DESC);

-- 3. RLS: public read, service write
ALTER TABLE model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_registry_public_read" ON model_registry FOR SELECT USING (true);
CREATE POLICY "model_registry_service_write" ON model_registry FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "model_rankings_public_read" ON model_rankings FOR SELECT USING (true);
CREATE POLICY "model_rankings_service_write" ON model_rankings FOR ALL USING (auth.role() = 'service_role');
