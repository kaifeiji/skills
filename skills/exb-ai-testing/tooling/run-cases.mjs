#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'

const require = createRequire(path.join(process.cwd(), 'package.json'))
const { chromium } = require('@playwright/test')

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const index = args.indexOf(name)
  return index === -1 ? fallback : args[index + 1]
}

const configPath = path.resolve(getArg('--config', process.env.TEST_CONFIG || ''))
const config = configPath && fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : null
if (!config) {
  console.error('Usage: node tooling/run-cases.mjs --config <config.json> [--mode headed|headless] [--output <dir>] [--case <case-id>]')
  process.exit(1)
}

const mode = getArg('--mode', process.env.TEST_MODE || 'headed')
if (!['headed', 'headless'].includes(mode)) {
  console.error('[run-cases] --mode must be headed or headless')
  process.exit(1)
}

const runRoot = path.resolve(getArg('--output', process.env.TEST_OUTPUT || defaultRunDir(config.slug)))
const selectedCase = getArg('--case', process.env.TEST_CASE)
const cases = (config.suite?.cases || []).filter((testCase) => !selectedCase || testCase.id === selectedCase)
if (!cases.length) {
  console.error(`[run-cases] No reviewed cases found${selectedCase ? ` for: ${selectedCase}` : ''}. Agent handoff is incomplete.`)
  process.exit(1)
}

fs.mkdirSync(runRoot, { recursive: true })
fs.writeFileSync(path.join(runRoot, 'run-config.json'), JSON.stringify(config, null, 2) + '\n')

const selectors = {
  chatInput: [
    'textarea[aria-label*="message" i]',
    'textarea[placeholder*="message" i]',
    'input[aria-label*="message" i]',
    '[contenteditable="true"]',
  ],
  sendButton: [
    'button[aria-label*="send" i]',
    'button[title*="send" i]',
  ],
  openChat: [
    'button.assistant-anchor[aria-haspopup="true"]',
    'button.assistant-anchor',
    'button[aria-label*="chat" i]',
    'button[title*="chat" i]',
  ],
  ready: [
    'textarea[aria-label*="message" i]',
    'textarea[placeholder*="message" i]',
    'input[aria-label*="message" i]',
    '[contenteditable="true"]',
  ],
}
const timeout = Number(config.timeouts?.turn || process.env.TEST_TURN_TIMEOUT || 45000)
const readyTimeout = Number(config.timeouts?.ready || process.env.TEST_READY_TIMEOUT || 30000)
const storageState = getArg('--storage-state', process.env.STORAGE_STATE || config.storageState)

if (!storageState) {
  console.error('[run-cases] Session handoff incomplete: provide --storage-state or config.storageState before running cases.')
  process.exit(1)
}
if (!fs.existsSync(path.resolve(storageState))) {
  console.error(`[run-cases] Session handoff incomplete: storage state not found at ${path.resolve(storageState)}`)
  process.exit(1)
}

function defaultRunDir(slug = 'app') {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return path.join('artifacts', `${date}-${slug}-01`)
}

async function findVisibleLocator(page, candidates, wait = 0) {
  const deadline = Date.now() + wait
  do {
    for (const selector of candidates) {
      const locator = page.locator(selector).first()
      if (await locator.isVisible().catch(() => false)) return locator
    }
    if (!wait) break
    await page.waitForTimeout(250)
  } while (Date.now() < deadline)
  return null
}

async function readRuntime(page) {
  return page.evaluate(() => {
    const runtime = window._assistantRuntime
    if (!runtime) return { available: false, transcript: null }
    return {
      available: true,
      transcript: runtime.debugTranscript ?? null,
      runtimeKeys: Object.keys(runtime),
    }
  }).catch((error) => ({ available: false, transcript: null, error: error.message }))
}

function terminalStatus(transcript) {
  const statuses = []
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit)
    } else if (value && typeof value === 'object') {
      if (typeof value.status === 'string') statuses.push(value.status.toLowerCase())
      Object.values(value).forEach((child) => {
        if (child && typeof child === 'object') visit(child)
      })
    }
  }
  visit(transcript)
  return statuses.reverse().find((status) => [
    'completed',
    'complete',
    'done',
    'success',
    'failed',
    'failure',
    'error',
  ].includes(status)) || null
}

async function waitForTurn(page, before, turnStartedAt) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const runtime = await readRuntime(page)
    const changed = JSON.stringify(runtime.transcript) !== JSON.stringify(before.transcript)
    const status = terminalStatus(runtime.transcript)
    if (changed && status) return { ...runtime, status }
    await page.waitForTimeout(500)
  }
  const runtime = await readRuntime(page)
  return {
    ...runtime,
    status: runtime.transcript == null ? 'runtime-unavailable' : 'timeout',
    turnStartedAt,
  }
}

async function writeCaseDebug(caseDir, caseInfo, runtime, turnRecords) {
  const lines = [
    `# Case Debug: ${caseInfo.title || caseInfo.id}`,
    '',
    `- Case ID: ${caseInfo.id}`,
    `- Runtime available: ${runtime.available ? 'yes' : 'no'}`,
    `- Turns executed: ${turnRecords.length}`,
    '',
    '## Turn Status',
    '',
    ...turnRecords.map((turn) => `- Turn ${turn.index}: ${turn.status}${turn.runtimeStatus ? ` (runtime: ${turn.runtimeStatus})` : ''}`),
    '',
    '## AssistantRuntime Evidence',
    '',
    '```json',
    JSON.stringify({ final: runtime, turns: turnRecords.map((turn) => ({
      index: turn.index,
      runtimeBefore: turn.runtimeBefore,
      runtimeAfter: turn.runtimeAfter,
    })) }, null, 2),
    '```',
  ]
  if (runtime.error) lines.splice(4, 0, `- Runtime read error: ${runtime.error}`)
  fs.writeFileSync(path.join(caseDir, 'case-debug.md'), lines.join('\n') + '\n')
}

async function runCase(page, testCase, index) {
  const caseDir = path.join(runRoot, testCase.id || `case-${index + 1}`)
  fs.mkdirSync(caseDir, { recursive: true })
  const result = {
    id: testCase.id,
    title: testCase.title,
    intent: testCase.intent,
    expectedBehavior: testCase.expectedBehavior,
    startedAt: new Date().toISOString(),
    status: 'running',
    turns: [],
  }
  let runtime = await readRuntime(page)

  for (let turnIndex = 0; turnIndex < (testCase.turns || []).length; turnIndex += 1) {
    const prompt = testCase.turns[turnIndex]
    const turnStartedAt = new Date().toISOString()
    const turn = { index: turnIndex + 1, prompt, startedAt: turnStartedAt, status: 'failed' }
    turn.runtimeBefore = runtime
    try {
      const input = await findVisibleLocator(page, selectors.chatInput, readyTimeout)
      if (!input) throw new Error('Chat input was not found using the built-in Playwright locators.')
      await input.fill(prompt)
      const send = await findVisibleLocator(page, selectors.sendButton)
      if (send) await send.click()
      else await input.press('Enter')
      const after = await waitForTurn(page, runtime, turnStartedAt)
      runtime = after
      turn.runtimeAfter = after
      turn.runtimeStatus = after.status
      turn.status = after.status
      turn.endedAt = new Date().toISOString()
      await page.screenshot({ path: path.join(caseDir, `turn-${String(turnIndex + 1).padStart(2, '0')}.png`), fullPage: true })
    } catch (error) {
      turn.error = error.message
      turn.runtimeAfter = await readRuntime(page)
      turn.runtimeStatus = turn.runtimeAfter.status || null
      turn.endedAt = new Date().toISOString()
      await page.screenshot({ path: path.join(caseDir, `turn-${String(turnIndex + 1).padStart(2, '0')}-error.png`), fullPage: true }).catch(() => {})
    }
    result.turns.push(turn)
    fs.writeFileSync(path.join(caseDir, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  }

  result.status = result.turns.some((turn) => [
    'failed',
    'timeout',
    'runtime-unavailable',
  ].includes(turn.status)) ? 'failed' : 'completed'
  result.endedAt = new Date().toISOString()
  result.runtimeAvailable = runtime.available
  result.runtimeTranscript = runtime.transcript
  fs.writeFileSync(path.join(caseDir, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  await writeCaseDebug(caseDir, testCase, runtime, result.turns)
  return result
}

const browser = await chromium.launch({ headless: mode === 'headless' })
const contextOptions = { ignoreHTTPSErrors: true }
contextOptions.storageState = path.resolve(storageState)
if (config.startup?.viewport === 'mobile') contextOptions.viewport = { width: 390, height: 844 }
if (config.startup?.viewport === 'desktop-large') contextOptions.viewport = { width: 1440, height: 1000 }
const context = await browser.newContext(contextOptions)
const results = []
try {
  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index]
    const page = await context.newPage()
    try {
      await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: readyTimeout })
      if (config.startup?.openChat) {
        const openChat = await findVisibleLocator(page, selectors.openChat, readyTimeout)
        if (openChat) await openChat.click()
      }
      if (config.startup?.requireVisibleChat !== false) {
        const ready = await findVisibleLocator(page, selectors.ready, readyTimeout)
        if (!ready) throw new Error('Chat input was not visible using the built-in Playwright locators.')
      }
      console.log(`[run-cases] Running ${testCase.id} (${index + 1}/${cases.length})`)
      results.push(await runCase(page, testCase, index))
    } catch (error) {
      const caseDir = path.join(runRoot, testCase.id || `case-${index + 1}`)
      fs.mkdirSync(caseDir, { recursive: true })
      const message = error instanceof Error ? error.message : String(error)
      const result = {
        id: testCase.id,
        title: testCase.title,
        status: 'failed',
        error: message,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        handoffFailure: true,
      }
      await page.screenshot({ path: path.join(caseDir, 'startup-error.png'), fullPage: true }).catch(() => {})
      fs.writeFileSync(path.join(caseDir, 'result.json'), JSON.stringify(result, null, 2) + '\n')
      fs.writeFileSync(path.join(caseDir, 'case-debug.md'), `# Case Debug: ${testCase.title || testCase.id}\n\n- Startup failed before turn execution.\n- Error: ${message}\n`)
      results.push(result)
    } finally {
      await page.close()
    }
  }
} finally {
  await context.close()
  await browser.close()
}

const summary = {
  config: configPath,
  url: config.url,
  mode,
  startedAt: results[0]?.startedAt || new Date().toISOString(),
  endedAt: new Date().toISOString(),
  total: results.length,
  passed: results.filter((result) => result.status === 'completed').length,
  failed: results.filter((result) => result.status === 'failed').length,
  cases: results.map(({ id, title, status }) => ({ id, title, status })),
}
fs.writeFileSync(path.join(runRoot, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(`[run-cases] Wrote artifacts to ${runRoot}`)
process.exitCode = summary.failed ? 2 : 0
