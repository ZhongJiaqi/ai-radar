-- ======================================================
-- AI Radar - Schema Upgrade: Category Slug Migration
-- Migrates Chinese category strings to English slugs
-- Also adds 'youtube' to sources.type CHECK
-- ======================================================

-- 1. Migrate existing category values
UPDATE processed_articles SET category = 'model_release'     WHERE category = '模型发布';
UPDATE processed_articles SET category = 'product_tool'      WHERE category = '产品工具';
UPDATE processed_articles SET category = 'research_paper'    WHERE category = '研究论文';
UPDATE processed_articles SET category = 'industry_news'     WHERE category = '行业动态';
UPDATE processed_articles SET category = 'funding_ma'        WHERE category = '融资并购';
UPDATE processed_articles SET category = 'policy_regulation' WHERE category = '政策监管';
UPDATE processed_articles SET category = 'open_source'       WHERE category = '开源项目';
UPDATE processed_articles SET category = 'opinion_insight'   WHERE category = '观点洞察';

-- 2. Replace CHECK constraint on processed_articles.category
ALTER TABLE processed_articles DROP CONSTRAINT IF EXISTS processed_articles_category_check;
ALTER TABLE processed_articles ADD CONSTRAINT processed_articles_category_check
  CHECK (category IN (
    'model_release', 'product_tool', 'research_paper',
    'industry_news', 'funding_ma', 'policy_regulation',
    'open_source', 'opinion_insight'
  ));

-- 3. Add 'youtube' to sources.type CHECK
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_type_check
  CHECK (type IN ('rss', 'api', 'scraper', 'twitter', 'youtube'));
