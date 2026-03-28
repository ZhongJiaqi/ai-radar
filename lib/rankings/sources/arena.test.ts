import assert from 'node:assert/strict'
import test from 'node:test'

import { parseArenaLeaderboardHTML, parseArenaOverviewHTMLForMath } from './arena'

test('parseArenaLeaderboardHTML extracts top ranks, model, score', () => {
  const html = `
    <div>Rank</div>
    <div>Rank Spread</div>
    <div>Organization</div>
    <div>Model</div>
    <div>Score</div>
    <div>Votes</div>
    <div>1</div>
    <div>1 2</div>
    <div>Anthropic</div>
    <div>claude-opus-4-6</div>
    <div>1548+12/-12</div>
    <div>4,059</div>
    <div>2</div>
    <div>OpenAI</div>
    <div>o3-2025-04-16</div>
    <div>1540+11/-11</div>
    <div>3,922</div>
    <div>3</div>
    <div>Google</div>
    <div>gemini-2.5-pro</div>
    <div>1520+10/-10</div>
    <div>2,201</div>
  `

  const rows = parseArenaLeaderboardHTML(html, 'Elo').slice(0, 3)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows.map(r => r.rank), [1, 2, 3])
  assert.equal(rows[0].model_raw, 'claude-opus-4-6')
  assert.equal(rows[0].score, 1548)
})

test('parseArenaOverviewHTMLForMath ranks by Math column (rank-based)', () => {
  const html = `
    <div>Overall Expert Hard Prompts Coding Math Creative Writing Instruction Following Longer Query</div>
    <div>Anthropic claude-opus-4-6-thinking</div>
    <div>1</div><div>1</div><div>1</div><div>4</div><div>1</div><div>1</div><div>1</div><div>3</div>
    <div>OpenAI o3-2025-04-16</div>
    <div>2</div><div>2</div><div>2</div><div>1</div><div>3</div><div>2</div><div>2</div><div>1</div>
    <div>Google gemini-2.5-pro</div>
    <div>3</div><div>3</div><div>3</div><div>2</div><div>2</div><div>3</div><div>3</div><div>2</div>
  `

  const rows = parseArenaOverviewHTMLForMath(html).slice(0, 3)
  assert.equal(rows.length, 3)
  // Math ranks are 1, 2, 3 -> output ranks should match that order.
  assert.equal(rows[0].model_raw, 'claude-opus-4-6-thinking')
  assert.equal((rows[0].metadata as any).arena_math_rank, 1)
  assert.equal(rows[0].score, null)
  assert.equal(rows[0].score_label, 'Rank')
})

