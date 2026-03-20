// ======================================================
// AI Radar - Category i18n Mapping
// ======================================================

import type { ContentCategory } from '../types'

export const CATEGORY_LABELS: Record<ContentCategory, { zh: string; en: string }> = {
  model_release:     { zh: '模型发布', en: 'Model Releases' },
  product_tool:      { zh: '产品工具', en: 'Products & Tools' },
  research_paper:    { zh: '研究论文', en: 'Research Papers' },
  industry_news:     { zh: '行业动态', en: 'Industry News' },
  funding_ma:        { zh: '融资并购', en: 'Funding & M&A' },
  policy_regulation: { zh: '政策监管', en: 'Policy & Regulation' },
  open_source:       { zh: '开源项目', en: 'Open Source' },
  opinion_insight:   { zh: '观点洞察', en: 'Opinions & Insights' },
}

export function categoryLabel(slug: ContentCategory, lang: 'zh' | 'en' = 'zh'): string {
  return CATEGORY_LABELS[slug]?.[lang] ?? slug
}
