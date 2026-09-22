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
const language = config.language || 'en'
if (!['en', 'zh'].includes(language)) {
  console.error('[run-cases] config.language must be en or zh')
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

async function inspectSession(page) {
  const pageInfo = await page.evaluate(() => ({
    title: document.title,
    url: location.href,
    bodyText: document.body?.innerText?.slice(0, 4000) || '',
    hasPasswordInput: Boolean(document.querySelector('input[type="password"]')),
    hasLoginForm: Boolean(document.querySelector('form[action*="oauth" i], form[action*="sign" i]')),
  })).catch(() => ({ title: '', url: page.url(), bodyText: '' }))
  const loginUrl = /\/sharing\/.*oauth2|\/home\/sign-in|\/signin/i.test(pageInfo.url)
  const loginTitle = /sign in|log in|登录/i.test(pageInfo.title)
  const loginText = /sign in|log in|登录|用户名|username|password/i.test(pageInfo.bodyText)
  if (loginUrl || loginTitle || pageInfo.hasPasswordInput || pageInfo.hasLoginForm || (loginText && !pageInfo.url.startsWith(config.url))) {
    throw new Error([
      '[run-cases] Session invalid or expired.',
      `The shared session was redirected to a sign-in page: ${pageInfo.url}`,
      'Agent action: ask the user to run capture-session.mjs, complete sign-in in the opened browser, and type READY before running cases again.',
    ].join('\n'))
  }
  return pageInfo
}

async function dismissBlockingModals(page) {
  const deadline = Date.now() + readyTimeout
  const confirmationPattern = /^(ok|okay|continue|confirm|accept|agree|got it|done|close|next|proceed|确定|确认|同意|继续|关闭|知道了|下一步)$/i
  let handled = 0

  while (Date.now() < deadline && handled < 5) {
    const dialogs = page.locator('[role="dialog"]:visible, dialog:visible')
    const count = await dialogs.count()
    if (!count) return handled

    let progressed = false
    for (let index = 0; index < count; index += 1) {
      const dialog = dialogs.nth(index)
      const checkboxes = dialog.locator('input[type="checkbox"]:visible, [role="checkbox"]:visible')
      for (let checkboxIndex = 0; checkboxIndex < await checkboxes.count(); checkboxIndex += 1) {
        const checkbox = checkboxes.nth(checkboxIndex)
        const checked = await checkbox.isChecked().catch(async () => (
          (await checkbox.getAttribute('aria-checked')) === 'true'
        ))
        if (!checked) await checkbox.click()
      }

      const buttons = dialog.locator('button:visible, [role="button"]:visible, input[type="button"]:visible, input[type="submit"]:visible')
      for (let buttonIndex = 0; buttonIndex < await buttons.count(); buttonIndex += 1) {
        const button = buttons.nth(buttonIndex)
        const label = [
          await button.innerText().catch(() => ''),
          await button.getAttribute('aria-label').catch(() => ''),
          await button.getAttribute('title').catch(() => ''),
          await button.getAttribute('value').catch(() => ''),
        ].join(' ').trim()
        if (confirmationPattern.test(label)) {
          await button.click()
          handled += 1
          progressed = true
          break
        }
      }
      if (progressed) break
    }
    if (!progressed) {
      const label = await dialogs.first().getAttribute('aria-label').catch(() => '')
      const text = (await dialogs.first().innerText().catch(() => '')).trim().slice(0, 300)
      throw new Error([
        '[run-cases] A blocking app dialog requires manual confirmation.',
        `Dialog: ${label || text || '(unlabeled dialog)'}`,
        'Agent action: ask the user to complete the dialog, including any required checkbox, then run the cases again.',
      ].join('\n'))
    }
    await page.waitForTimeout(250)
  }
  return handled
}

async function validateSessionAndChat(page) {
  try {
    await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: readyTimeout })
    await waitForNetworkIdle(page)
    await inspectSession(page)
    await dismissBlockingModals(page)
    await inspectSession(page)
  } catch (error) {
    if (error.message.startsWith('[run-cases] Session invalid')) throw error
    throw new Error([
      '[run-cases] Session validation failed.',
      error.message,
      'Agent action: ask the user to verify the app URL and refresh the shared session with capture-session.mjs.',
    ].join('\n'))
  }

  const existingInput = await findVisibleLocator(page, selectors.ready, readyTimeout)
  if (!existingInput) {
    const openChat = await findVisibleLocator(page, selectors.openChat, readyTimeout)
    if (openChat) await openChat.click()
  }
  const chatInput = await findVisibleLocator(page, selectors.ready, readyTimeout)
  if (!chatInput) {
    throw new Error([
      '[run-cases] AI Chat is unavailable or not enabled for this app.',
      'The session is valid, but no supported AI Chat launcher or message input was found.',
      'Agent action: ask the user to enable/configure AI Chat in the Experience Builder app, publish the change if required, and run the cases again.',
    ].join('\n'))
  }
  return { pageInfo: await inspectSession(page), chatInput }
}

async function readRuntime(page) {
  return page.evaluate((language) => {
    const runtime = window._assistantRuntime
    if (!runtime) return { available: false, transcript: null }
    const clip = (value, limit = 20_000) => {
      if (typeof value !== 'string') return value
      return value.length > limit ? `${value.slice(0, limit)}...[truncated ${value.length - limit} chars]` : value
    }
    const contentText = (value) => {
      if (typeof value === 'string') return clip(value)
      try {
        return clip(JSON.stringify(value))
      } catch {
        return '[unserializable content]'
      }
    }
    const pickMessage = (message) => ({
      id: message?.id || null,
      type: message?.type || null,
      name: message?.name || null,
      content: contentText(message?.content),
    })
    const state = runtime.state || {}
    const completedSteps = (state.completedSteps || runtime.completedSteps || []).map((step) => ({
      description: step?.description || null,
      agent: step?.agent || null,
      humanMessageId: step?.humanMessageId || null,
      output: step?.output ? {
        type: step.output.type || null,
        description: step.output.description || null,
        payload: contentText(step.output.payload),
        streamedToUser: step.output.streamedToUser ?? null,
      } : null,
    }))
    const plannedSteps = (state.plannedSteps || []).map((step) => ({
      description: step?.description || null,
      agent: step?.agent || null,
      humanMessageId: step?.humanMessageId || null,
    }))
    const pendingSteps = (state.pendingSteps || []).map((step) => ({
      description: step?.description || null,
      agent: step?.agent || null,
      humanMessageId: step?.humanMessageId || null,
    }))
    const chatHistory = (runtime.chatHistory || []).map(pickMessage)
    const userInputs = (state.userInputs || []).map(pickMessage)
    const messages = (state.messages || []).map(pickMessage)
    const context = {
      visibleWidgets: (state.context?.visibleWidgets || []).map((widget) => ({
        widgetId: widget?.widgetId || widget?.id || null,
        name: widget?.name || null,
        type: widget?.type || null,
      })),
      aiRenderers: (state.context?.aiRenderers || []).map((renderer) => ({
        name: renderer?.name || null,
        description: renderer?.description || null,
      })),
    }
    const transcript = runtime.debugTranscript ?? null
    const sectionLabels = language === 'zh'
      ? {
          'user-question': '用户提问',
          'intermediate-reasoning': '中间推理',
          'streamed-output': '输出流',
          'intermediate-result': '中间结果',
          'final-result': '最后结果',
          error: '错误',
        }
      : {
          'user-question': 'User question',
          'intermediate-reasoning': 'Intermediate reasoning',
          'streamed-output': 'Streamed output',
          'intermediate-result': 'Intermediate result',
          'final-result': 'Final result',
          error: 'Error',
        }
    const debugText = Array.isArray(transcript) && transcript.some((turn) => turn?.entries?.length)
      ? [
          '# AI Assistant Debug Transcript',
          '',
          ...transcript.flatMap((turn, index) => [
            `## Turn ${index + 1}`,
            `- Message ID: ${turn.messageId || '(missing)'}`,
            `- Status: ${turn.status || 'running'}`,
            `- Started: ${turn.startedAt || '(missing)'}`,
            ...(turn.endedAt ? [`- Ended: ${turn.endedAt}`] : []),
            '',
            ...(turn.entries || []).flatMap((entry) => [
              `### ${sectionLabels[entry.section] || entry.section || 'Debug'} - ${entry.title || '(untitled)'}`,
              entry.timestamp ? `_Recorded at ${entry.timestamp}_` : '',
              '',
              entry.content || '(empty)',
              '',
            ]),
          ]),
        ].join('\n')
      : ''
    return {
      available: true,
      transcript,
      debugText,
      runtimeKeys: Object.keys(runtime),
      runtimeReady: runtime.runtimeReady ?? null,
      threadId: runtime.threadId || null,
      streamEpoch: runtime.streamEpoch ?? null,
      isWorking: runtime.isWorking ?? null,
      chatHistory,
      userInputs,
      messages,
      planReason: state.planReason || null,
      reasoningMetadata: state.reasoningMetadata || null,
      plannedSteps,
      pendingSteps,
      completedSteps,
      context,
      mentionedVisibleWidgetIds: state.mentionedVisibleWidgetIds || [],
      evaluation: state.evaluation || null,
      suggestions: state.suggestions || [],
      signal: {
        transcriptLength: Array.isArray(transcript) ? transcript.length : 0,
        chatHistoryLength: chatHistory.length,
        userInputCount: userInputs.length,
        messageCount: messages.length,
        completedStepCount: completedSteps.length,
        pendingStepCount: pendingSteps.length,
        isWorking: runtime.isWorking ?? null,
        streamEpoch: runtime.streamEpoch ?? null,
        latestCompletedMessageId: completedSteps.at(-1)?.humanMessageId || null,
      },
    }
  }, language).catch((error) => ({ available: false, transcript: null, error: error.message }))
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

function runtimeTerminalStatus(runtime, before) {
  const completedBefore = before?.signal?.completedStepCount || 0
  const completedAfter = runtime?.signal?.completedStepCount || 0
  if (runtime?.isWorking === false && completedAfter > completedBefore) return 'completed'
  return null
}

async function waitForTurn(page, before, turnStartedAt) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const runtime = await readRuntime(page)
    const changed = JSON.stringify(runtime.signal) !== JSON.stringify(before.signal)
    const status = terminalStatus(runtime.transcript) || runtimeTerminalStatus(runtime, before)
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
  const detailedTranscript = [...turnRecords]
    .reverse()
    .map((turn) => turn.debugText)
    .find(Boolean) || runtime.debugText || ''
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
    '## AssistantRuntime Debug Log',
    '',
    detailedTranscript || 'No detailed AssistantRuntime entries were available.',
    '',
    '## Turn Evidence',
    '',
    '```json',
    JSON.stringify(turnRecords.map((turn) => ({
      index: turn.index,
      prompt: turn.prompt,
      status: turn.status,
      runtimeStatus: turn.runtimeStatus || null,
      startedAt: turn.startedAt,
      endedAt: turn.endedAt || null,
      durationMs: turn.durationMs ?? null,
      runtimeBefore: turn.runtimeBefore?.signal || null,
      runtimeAfter: turn.runtimeAfter ? {
        signal: turn.runtimeAfter.signal || null,
        threadId: turn.runtimeAfter.threadId || null,
        reasoningMetadata: turn.runtimeAfter.reasoningMetadata || null,
        plannedSteps: turn.runtimeAfter.plannedSteps || [],
        completedSteps: turn.runtimeAfter.completedSteps || [],
        evaluation: turn.runtimeAfter.evaluation || null,
      } : null,
      error: turn.error || null,
    })), null, 2),
    '```',
    '',
    '## Runtime Snapshots',
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
  const turnRecords = []

  for (let turnIndex = 0; turnIndex < (testCase.turns || []).length; turnIndex += 1) {
    const prompt = testCase.turns[turnIndex]
    const turnStartedMs = Date.now()
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
      turn.debugText = after.debugText || ''
      turn.status = after.status
      turn.endedAt = new Date().toISOString()
      await page.screenshot({ path: path.join(caseDir, `turn-${String(turnIndex + 1).padStart(2, '0')}.png`), fullPage: true })
    } catch (error) {
      turn.error = error.message
      turn.runtimeAfter = await readRuntime(page)
      turn.runtimeStatus = turn.runtimeAfter.status || null
      turn.debugText = turn.runtimeAfter.debugText || ''
      turn.endedAt = new Date().toISOString()
      await page.screenshot({ path: path.join(caseDir, `turn-${String(turnIndex + 1).padStart(2, '0')}-error.png`), fullPage: true }).catch(() => {})
    }
    turn.durationMs = Date.now() - turnStartedMs
    turnRecords.push(turn)
    const latestStep = [...(turn.runtimeAfter?.completedSteps || [])].reverse()[0]
    result.turns.push({
      index: turn.index,
      prompt: turn.prompt,
      agentResponse: latestStep?.output?.payload || null,
      status: turn.status,
      runtimeStatus: turn.runtimeStatus || null,
      startedAt: turn.startedAt,
      endedAt: turn.endedAt || null,
      durationMs: turn.durationMs,
      error: turn.error || null,
      screenshot: `turn-${String(turn.index).padStart(2, '0')}${turn.error ? '-error' : ''}.png`,
    })
    fs.writeFileSync(path.join(caseDir, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  }

  result.status = result.turns.some((turn) => [
    'failed',
    'timeout',
    'runtime-unavailable',
  ].includes(turn.status)) ? 'failed' : 'completed'
  result.endedAt = new Date().toISOString()
  result.runtimeAvailable = runtime.available
  fs.writeFileSync(path.join(caseDir, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  await writeCaseDebug(caseDir, testCase, runtime, turnRecords)
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
  let preflightError = null
  const preflightPage = await context.newPage()
  try {
    await validateSessionAndChat(preflightPage)
    console.log('[run-cases] Session is valid and AI Chat is available.')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    fs.writeFileSync(path.join(runRoot, 'preflight-error.json'), JSON.stringify({
      status: 'failed',
      error: message,
      createdAt: new Date().toISOString(),
    }, null, 2) + '\n')
    console.error(message)
    process.exitCode = 1
    preflightError = message
  } finally {
    await preflightPage.close()
  }
  if (!preflightError) for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index]
    const page = await context.newPage()
    try {
      await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: readyTimeout })
      await waitForNetworkIdle(page)
      await inspectSession(page)
      await dismissBlockingModals(page)
      await inspectSession(page)
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

async function waitForNetworkIdle(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: readyTimeout })
  } catch {
    console.log('[run-cases] Network idle was not reached; continuing with the configured UI readiness check.')
  }
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
