import Anthropic from '@anthropic-ai/sdk'

// Anthropic API client
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
})

// Model selection
// Haiku 4.5: fast + cheap for article processing
// Sonnet 4.6: deeper analysis for daily digest
// NOTE: Right Code 的 Claude 网关目前公开文档列出的模型以 Sonnet/Opus 为主，
// 为避免因为模型不在网关白名单而触发 400，这里提供可通过环境变量覆盖的默认值。
export const HAIKU_MODEL = process.env.CLAUDE_SMALL_MODEL || 'claude-sonnet-4-5-20250929'
export const SONNET_MODEL = process.env.CLAUDE_LARGE_MODEL || 'claude-sonnet-4-5-20250929-thinking'
