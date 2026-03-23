// ======================================================
// AI Radar - Investment taxonomy (major + detail)
// Source of truth: invest.md (two-level: major bucket + detailed sub-sector)
// ======================================================

export type InvestmentSectorMajor =
  | 'energy_power'
  | 'compute_infra'
  | 'models_platform'
  | 'data'
  | 'applications_devices'
  | 'governance_services_other'

export interface InvestmentSectorDetail {
  slug: string
  zh: string
  major: InvestmentSectorMajor
}

export const INVESTMENT_SECTOR_MAJOR_LABELS: Record<InvestmentSectorMajor, string> = {
  energy_power: '能源/电力',
  compute_infra: '算力&基础设施',
  models_platform: '模型&平台',
  data: '数据',
  applications_devices: '应用&终端',
  governance_services_other: '治理&服务&其他',
}

export const INVESTMENT_SECTOR_DETAILS: InvestmentSectorDetail[] = [
  { slug: 'power_energy', zh: '能源/AI 专用电力', major: 'energy_power' },

  { slug: 'chips_hardware', zh: '芯片与硬件', major: 'compute_infra' },
  { slug: 'datacenters_edge', zh: '数据中心与边缘算力', major: 'compute_infra' },
  { slug: 'network_connectivity', zh: '网络与连接', major: 'compute_infra' },
  { slug: 'ops_efficiency', zh: '运维与能效（散热/液冷/UPS）', major: 'compute_infra' },

  { slug: 'foundation_models', zh: '基础模型与算法（大模型生态）', major: 'models_platform' },
  { slug: 'mlops_platform', zh: '平台与中间件（训练/推理/MLOps）', major: 'models_platform' },

  { slug: 'data_collection_labeling', zh: '数据采集/标注', major: 'data' },
  { slug: 'synthetic_privacy', zh: '合成数据/隐私/联邦学习', major: 'data' },
  { slug: 'data_marketplace', zh: '数据交易/数据资产', major: 'data' },

  { slug: 'industry_apps', zh: '行业应用（垂直SaaS/解决方案）', major: 'applications_devices' },
  { slug: 'devices_sensors_robots', zh: '终端/传感/机器人', major: 'applications_devices' },

  { slug: 'security_compliance', zh: '安全/合规/治理', major: 'governance_services_other' },
  { slug: 'services_si', zh: '服务生态/系统集成', major: 'governance_services_other' },
  { slug: 'supporting_industry', zh: '支撑产业（EDA/材料/封测等）', major: 'governance_services_other' },
  { slug: 'frontier', zh: '创新前沿（量子/光算/神经形态）', major: 'governance_services_other' },
]

export const INVESTMENT_SECTOR_MAJOR: InvestmentSectorMajor[] = Object.keys(
  INVESTMENT_SECTOR_MAJOR_LABELS
) as InvestmentSectorMajor[]

export const INVESTMENT_SECTOR_DETAIL_SLUGS = INVESTMENT_SECTOR_DETAILS.map(d => d.slug)

export function resolveDetail(slug: string): InvestmentSectorDetail | null {
  return INVESTMENT_SECTOR_DETAILS.find(d => d.slug === slug) || null
}

