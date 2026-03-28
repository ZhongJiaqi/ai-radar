import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase'
import type { ModelDomain, ModelRankingRow } from '@/lib/rankings/types'

export const revalidate = 60

const DOMAIN_META: Record<ModelDomain, { zh: string; en: string; hint: string }> = {
  coding: { zh: '编程', en: 'Coding', hint: '代码能力与工程任务' },
  math:   { zh: '数学', en: 'Math',   hint: '数学推理与计算' },
  text:   { zh: '文本', en: 'Text',   hint: '通用对话与写作' },
  image:  { zh: '图片', en: 'Image',  hint: '图像生成/编辑' },
  video:  { zh: '视频', en: 'Video',  hint: '视频生成/编辑' },
  audio:  { zh: '语音', en: 'Audio',  hint: '语音理解/生成' },
}

const DOMAIN_ORDER: ModelDomain[] = ['coding', 'text', 'image', 'video']

function scoreText(r: Pick<ModelRankingRow, 'score' | 'score_label' | 'metadata' | 'rank'>): string {
  if (typeof r.score === 'number') return `${Math.round(r.score)}`
  if (r.score_label === 'Rank') {
    const v = (r.metadata as any)?.arena_math_rank
    if (typeof v === 'number') return `#${v}`
    return `#${r.rank}`
  }
  return '—'
}

async function getRankings(): Promise<ModelRankingRow[]> {
  const supabase = createPublicClient()
  try {
    const { data, error } = await supabase
      .from('model_rankings')
      .select('domain, rank, model_key, model_name, score, score_label, source_name, source_url, captured_at, metadata')
      .lte('rank', 3)
      .order('domain', { ascending: true })
      .order('rank', { ascending: true })
      .limit(18)
    if (error) return []
    return (data || []) as ModelRankingRow[]
  } catch {
    return []
  }
}

export default async function ModelsPage() {
  const rankings = await getRankings()

  const byDomain = new Map<ModelDomain, ModelRankingRow[]>()
  for (const r of rankings) {
    const arr = byDomain.get(r.domain) || []
    arr.push(r)
    byDomain.set(r.domain, arr)
  }

  const lastUpdated = rankings.reduce<Date | null>((acc, r) => {
    const d = new Date(r.captured_at)
    if (!Number.isFinite(d.getTime())) return acc
    return !acc || d > acc ? d : acc
  }, null)

  return (
    <div>
      <header className="mb-10 pb-6 border-b border-gray-200">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono text-[11px] text-gray-400 uppercase tracking-widest mb-2">Models</p>
            <h1 className="text-[1.75rem] font-semibold text-gray-900 tracking-tight leading-none">模型排行</h1>
            <p className="text-[15px] text-gray-600 mt-3 leading-relaxed">
              基于公开榜单聚合的分领域 Top 3，数据仅供参考。
            </p>
          </div>
          <span className="font-mono text-[11px] text-gray-300">
            {lastUpdated ? lastUpdated.toISOString().slice(0, 16).replace('T', ' ') : '—'}
          </span>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {DOMAIN_ORDER.map(domain => {
          const entries = (byDomain.get(domain) || []).sort((a, b) => a.rank - b.rank)
          const meta = DOMAIN_META[domain]
          const source = entries[0]

          return (
            <div key={domain} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-gray-900">{meta.zh}</h2>
                    <p className="text-[13px] text-gray-500 mt-1">{meta.hint}</p>
                  </div>
                  <span className="font-mono text-[11px] text-gray-300">
                    {entries[0]?.score_label || 'Elo'}
                  </span>
                </div>
              </div>

              {/* Entries */}
              <div className="px-6 py-4">
                {entries.length === 0 ? (
                  <p className="py-6 text-[13px] text-gray-400">
                    {domain === 'audio' ? '暂未接入语音榜单' : '暂无数据'}
                  </p>
                ) : (
                  <ol className="flex flex-col divide-y divide-gray-100">
                    {entries.map(r => (
                      <li key={`${r.domain}-${r.rank}-${r.model_key}`}
                        className="flex items-center gap-3 py-3.5">
                        <span className="font-mono text-[11px] text-gray-300 w-4 text-right flex-shrink-0">
                          {r.rank}
                        </span>
                        <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">
                          {r.model_name}
                        </span>
                        <span className="font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          {scoreText(r)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                {source?.source_url && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <a href={source.source_url} target="_blank" rel="noopener noreferrer"
                      className="text-[13px] text-gray-500 hover:text-blue-600 transition-colors">
                      来源: {source.source_name} →
                    </a>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </section>

      <div className="mt-12 pt-6 border-t border-gray-200">
        <Link href="/" className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">
          ← 返回资讯
        </Link>
      </div>
    </div>
  )
}
