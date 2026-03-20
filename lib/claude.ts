import Anthropic from '@anthropic-ai/sdk'

// Anthropic API client
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Model selection
// Haiku 3.5: fast + cheap for article processing ($0.80/$4 per 1M tokens)
// Sonnet 4: deeper analysis for daily digest ($3/$15 per 1M tokens)
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
export const SONNET_MODEL = 'claude-sonnet-4-6'
