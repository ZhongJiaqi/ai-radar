import Anthropic from '@anthropic-ai/sdk'

// Anthropic API client
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
})

// Model selection
// Haiku 4.5: fast + cheap for article processing
// Sonnet 4.6: deeper analysis for daily digest
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
export const SONNET_MODEL = 'claude-sonnet-4-6'
