import Anthropic from '@anthropic-ai/sdk'

export type LLMProvider = 'anthropic' | 'openai-compatible'
export type LLMTask = 'article' | 'digest'

interface GenerateParams {
  task: LLMTask
  prompt: string
  maxTokens: number
}

interface GenerateResult {
  text: string
  modelUsed: string
  provider: LLMProvider
}

interface ResolvedConfig {
  provider: LLMProvider
  apiKey: string
  baseURL: string
  model: string
}

function trimOrEmpty(value: string | undefined): string {
  return value?.trim() || ''
}

function normalizeAnthropicBaseURL(raw: string): string {
  try {
    const u = new URL(raw)
    if (u.hostname === 'right.codes') u.hostname = 'www.right.codes'
    return u.toString().replace(/\/+$/, '')
  } catch {
    return raw.replace(/\/+$/, '')
  }
}

function normalizeBaseURL(raw: string, provider: LLMProvider): string {
  const fallback = provider === 'anthropic'
    ? 'https://api.anthropic.com'
    : 'https://dashscope.aliyuncs.com/compatible-mode/v1'

  const value = trimOrEmpty(raw) || fallback
  return provider === 'anthropic'
    ? normalizeAnthropicBaseURL(value)
    : value.replace(/\/+$/, '')
}

function inferProvider(baseURL: string): LLMProvider {
  const normalized = trimOrEmpty(baseURL).toLowerCase()
  if (!normalized) return 'anthropic'
  if (
    normalized.includes('anthropic.com') ||
    normalized.includes('right.codes') ||
    normalized.includes('/claude')
  ) {
    return 'anthropic'
  }
  return 'openai-compatible'
}

function defaultModelFor(task: LLMTask, provider: LLMProvider, baseURL: string): string {
  const normalized = baseURL.toLowerCase()

  if (provider === 'anthropic') {
    return task === 'article'
      ? 'claude-3-5-haiku-20241022'
      : 'claude-sonnet-4-5-20250929'
  }

  if (normalized.includes('dashscope.aliyuncs.com')) {
    return task === 'article' ? 'qwen-plus' : 'qwen-max'
  }

  if (normalized.includes('api.openai.com')) {
    return task === 'article' ? 'gpt-4.1-mini' : 'gpt-4.1'
  }

  const explicitModel =
    trimOrEmpty(process.env.LLM_MODEL) ||
    trimOrEmpty(process.env.CLAUDE_SMALL_MODEL) ||
    trimOrEmpty(process.env.CLAUDE_LARGE_MODEL)

  if (explicitModel) return explicitModel

  throw new Error(
    `No default model is defined for ${baseURL}. Set LLM_MODEL to use this OpenAI-compatible endpoint.`
  )
}

function resolveConfig(task: LLMTask): ResolvedConfig {
  const apiKey =
    trimOrEmpty(process.env.LLM_API_KEY)

  if (!apiKey) {
    throw new Error('Missing LLM_API_KEY')
  }

  const rawBaseURL =
    trimOrEmpty(process.env.LLM_BASE_URL)

  const provider = inferProvider(rawBaseURL)
  const baseURL = normalizeBaseURL(rawBaseURL, provider)
  const model =
    trimOrEmpty(process.env.LLM_MODEL) ||
    (
      task === 'article'
        ? trimOrEmpty(process.env.CLAUDE_SMALL_MODEL)
        : trimOrEmpty(process.env.CLAUDE_LARGE_MODEL)
    ) ||
    defaultModelFor(task, provider, baseURL)

  return { provider, apiKey, baseURL, model }
}

// LLM_MODEL_CHAIN is a comma-separated list of model IDs to try in order
// when the primary model returns a quota / free-tier error. The first item
// is the primary; subsequent items are fallbacks. Whitespace tolerated.
function resolveModelChain(task: LLMTask): string[] {
  const raw = trimOrEmpty(process.env.LLM_MODEL_CHAIN)
  const primary = resolveConfig(task).model
  if (!raw) return [primary]
  const chain = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  // Ensure primary is first; dedupe while preserving order.
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const m of [primary, ...chain]) {
    if (seen.has(m)) continue
    seen.add(m)
    ordered.push(m)
  }
  return ordered
}

// Errors worth swapping models for: free-tier exhaustion, quota,
// rate limit. We do NOT swap on network or 5xx errors — those are
// transient and callWithRetry handles them.
function isQuotaExhaustionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { status?: number; message?: string }
  if (e.status === 429) return true
  if (e.status !== 403) return false
  const msg = (e.message || '').toLowerCase()
  return (
    msg.includes('freetieronly') ||
    msg.includes('free tier') ||
    msg.includes('allocationquota') ||
    msg.includes('exhausted') ||
    msg.includes('insufficient') ||
    msg.includes('quota')
  )
}

const toErrText = (err: unknown): string => {
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>
    const message = anyErr.message
    if (typeof message === 'string') return message
  }
  return String(err)
}

const shouldRetry = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return true
  const status = (err as { status?: number }).status
  if (typeof status !== 'number') return true
  return status === 429 || status >= 500
}

async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries - 1 || !shouldRetry(err)) throw err
      const delay = Math.pow(2, i) * 1000
      console.warn(`[LLM] Retry ${i + 1}/${retries} after ${delay}ms: ${toErrText(err)}`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Unreachable')
}

async function generateWithAnthropic(config: ResolvedConfig, prompt: string, maxTokens: number): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  })

  const response = await anthropic.messages.create({
    model: config.model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  })

  const block = response.content[0]
  return block?.type === 'text' ? block.text.trim() : ''
}

async function generateWithOpenAICompatible(config: ResolvedConfig, prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    const err = new Error(`OpenAI-compatible request failed (${response.status}): ${body.slice(0, 300)}`) as Error & { status?: number }
    err.status = response.status
    throw err
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>
  }

  const content = payload.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .map(part => typeof part?.text === 'string' ? part.text : '')
      .join('')
      .trim()
  }
  return ''
}

async function generate(params: GenerateParams): Promise<GenerateResult> {
  const baseConfig = resolveConfig(params.task)
  const chain = resolveModelChain(params.task)
  const errors: string[] = []

  for (let i = 0; i < chain.length; i++) {
    const config: ResolvedConfig = { ...baseConfig, model: chain[i] }
    try {
      const text = await callWithRetry(async () => {
        if (config.provider === 'anthropic') {
          return generateWithAnthropic(config, params.prompt, params.maxTokens)
        }
        return generateWithOpenAICompatible(config, params.prompt, params.maxTokens)
      })
      if (!text) throw new Error('LLM returned empty content')
      if (i > 0) {
        console.warn(
          `[LLM] Falling back to model ${config.model} after ${i} exhausted upstream(s)`
        )
      }
      return {
        text,
        modelUsed: `${config.provider}:${config.model}`,
        provider: config.provider,
      }
    } catch (err) {
      errors.push(`${chain[i]}: ${toErrText(err)}`)
      // Only try next model on quota / free-tier exhaustion. Other errors
      // (transient, programming, prompt) bubble up immediately.
      if (!isQuotaExhaustionError(err) || i === chain.length - 1) throw err
      console.warn(
        `[LLM] Model ${chain[i]} exhausted (${(err as { status?: number }).status}), trying ${chain[i + 1]}`
      )
    }
  }

  // Unreachable — the loop either returns or throws.
  throw new Error(`All LLM models exhausted: ${errors.join(' | ')}`)
}

export async function generateJson(params: GenerateParams): Promise<GenerateResult> {
  return generate(params)
}

export async function generateText(params: GenerateParams): Promise<GenerateResult> {
  return generate(params)
}

export function getResolvedLLMConfig(task: LLMTask) {
  return resolveConfig(task)
}
