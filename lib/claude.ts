import Anthropic from '@anthropic-ai/sdk'

function normalizeAnthropicBaseURL(raw: string): string {
  try {
    const u = new URL(raw)
    // Right Code 文档里 API 入口是 https://www.right.codes/... ，而 CLI 教程常用 https://right.codes/...
    // 为了避免误配导致的 400（提示需要 Claude Code 客户端），这里自动把 right.codes 归一到 www.right.codes。
    if (u.hostname === 'right.codes') u.hostname = 'www.right.codes'
    // Anthropic SDK 会自行拼接 /v1/messages，保持 baseURL 不以 / 结尾更稳妥。
    return u.toString().replace(/\/+$/, '')
  } catch {
    return raw
  }
}

// Anthropic API client
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: normalizeAnthropicBaseURL(
    process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
  ),
})

// Model selection
// Haiku 4.5: fast + cheap for article processing
// Sonnet 4.6: deeper analysis for daily digest
// NOTE: Right Code 的 Claude 网关目前公开文档列出的模型以 Sonnet/Opus 为主，
// 为避免因为模型不在网关白名单而触发 400，这里提供可通过环境变量覆盖的默认值。
export const HAIKU_MODEL = process.env.CLAUDE_SMALL_MODEL || 'claude-sonnet-4-5-20250929'
// 之前默认使用 *thinking* 变体会在部分 Right Code 端点（如 /claude-aws）触发
// “未配置模型”导致 workflow 失败；这里默认回退到通用的 sonnet 变体，必要时再用环境变量覆盖。
export const SONNET_MODEL =
  process.env.CLAUDE_LARGE_MODEL ||
  process.env.CLAUDE_SMALL_MODEL ||
  'claude-sonnet-4-5-20250929'
