#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { loadPlaywright } from './load-playwright.mjs'
import { getViewport } from './viewport-utils.mjs'

const { chromium } = loadPlaywright()

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const index = args.indexOf(name)
  return index === -1 ? fallback : args[index + 1]
}

const configPath = path.resolve(getArg('--config', process.env.TEST_CONFIG || ''))
const config = configPath && fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : null
if (!config) {
  console.error('Usage: node tooling/run-cases.mjs --config <config.json> [--mode headed|headless] [--output <dir>] [--case <case-id>] [--cache-dir <dir>]')
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

const runRoot = path.resolve(getArg('--output', process.env.TEST_OUTPUT || defaultRunDir()))
const selectedCase = getArg('--case', process.env.TEST_CASE)
const cacheDir = path.resolve(getArg('--cache-dir', process.env.TEST_CACHE_DIR || path.join('config', '.cache', 'browser-profile')))
const cases = (config.suite?.cases || []).filter((testCase) => !selectedCase || testCase.id === selectedCase)
if (!cases.length) {
  console.error(`[run-cases] No reviewed cases found${selectedCase ? ` for: ${selectedCase}` : ''}. Agent handoff is incomplete.`)
  process.exit(1)
}
const casesWithInvalidNames = cases.filter((testCase) => (
  typeof testCase.title !== 'string' || !testCase.title.trim() ||
  typeof testCase.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(testCase.id) ||
  /^(?:page|widget|view|case)[_-]?\d+$/i.test(testCase.id)
))
if (casesWithInvalidNames.length) {
  console.error(`[run-cases] Case id/title must use a page title or business goal, with id in lowercase kebab-case. Invalid: ${casesWithInvalidNames.map((testCase) => testCase.id || '(missing id)').join(', ')}`)
  process.exit(1)
}
const appPages = config.appContext?.pages || []
const casesWithInvalidPage = cases.filter((testCase) => !appPages.some((page) => page.id === testCase.pageId))
if (casesWithInvalidPage.length) {
  console.error(`[run-cases] Every case pageId must match appContext.pages. Invalid: ${casesWithInvalidPage.map((testCase) => testCase.pageId || '(missing pageId)').join(', ')}`)
  process.exit(1)
}
const casesMissingPageUrl = cases.filter((testCase) => !testCase.pageUrl)
if (casesMissingPageUrl.length) {
  console.error(`[run-cases] Every case requires pageUrl. Missing: ${casesMissingPageUrl.map((testCase) => testCase.id).join(', ')}`)
  process.exit(1)
}

fs.mkdirSync(runRoot, { recursive: true })
fs.writeFileSync(path.join(runRoot, 'run-config.json'), JSON.stringify(config, null, 2) + '\n')

const selectors = {
  chatInput: [
    'calcite-text-area textarea',
    'textarea[aria-label*="message" i]',
    'textarea[placeholder*="message" i]',
    'input[aria-label*="message" i]',
    '[contenteditable="true"]',
  ],
  sendButton: [
    'button[aria-label*="send" i]',
    'button[title*="send" i]',
  ],
  ready: [
    'calcite-text-area textarea',
    'textarea[aria-label*="message" i]',
    'textarea[placeholder*="message" i]',
    'input[aria-label*="message" i]',
    '[contenteditable="true"]',
  ],
}
const readyTimeout = Number(config.timeouts?.ready || process.env.TEST_READY_TIMEOUT || 30000)
const turnTimeout = Number(config.timeouts?.turn || process.env.TEST_TURN_TIMEOUT || 120000)

function defaultRunDir() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const configStem = path.basename(configPath, path.extname(configPath))
  let sequence = 1
  while (true) {
    const runDir = path.join('artifacts', `${date}-${configStem}-${String(sequence).padStart(2, '0')}`)
    if (!fs.existsSync(runDir)) return runDir
    sequence += 1
  }
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
  await page.waitForFunction(() => Boolean(window._sessionManager), null, { timeout: readyTimeout })
  await page.waitForFunction(
    () => Boolean(window._sessionManager?.getMainSession?.()),
    null,
    { timeout: readyTimeout },
  ).catch(() => {})
  const sessionState = await page.evaluate(() => {
    const sessionManager = window._sessionManager
    if (sessionManager.getMainSession()) return 'signed-in'
    return sessionManager.isMainSessionExpired() ? 'expired' : 'signed-out'
  })
  if (sessionState !== 'signed-in') {
    const error = new Error([
      `[run-cases] App session is ${sessionState}.`,
      'Agent action: run probe-session.mjs and complete the app sign-in flow in the opened browser before running cases again.',
    ].join('\n'))
    error.code = 'SESSION_INVALID'
    throw error
  }
  return sessionState
}

async function dismissBlockingModals(page) {
  const deadline = Date.now() + readyTimeout
  const graceDeadline = Date.now() + Math.min(5000, readyTimeout)
  let handled = 0

  while (Date.now() < deadline && handled < 5) {
    const dialogs = page.locator('[role="dialog"]:visible, dialog:visible')
    const count = await dialogs.count()
    if (!count) {
      if (handled > 0 || Date.now() >= graceDeadline) return handled
      await page.waitForTimeout(250)
      continue
    }

    const closed = await page.evaluate(() => {
      const store = window._appStore
      const state = store?.getState?.()
      const dialogId = state?.appRuntimeInfo?.currentDialogId
      const dialogInfos = state?.appRuntimeInfo?.dialogInfos
      if (!store?.dispatch || !dialogId) return false
      const currentInfos = dialogInfos?.toJS?.() || dialogInfos || {}
      store.dispatch({
        type: 'DIALOG_INFOS_CHANGED',
        dialogInfos: {
          ...currentInfos,
          [dialogId]: {
            ...(currentInfos[dialogId] || {}),
            canClose: true,
            checked: true,
            isClosed: true,
          },
        },
      })
      store.dispatch({ type: 'CURRENT_DIALOG_CHANGED', dialogId: null })
      return true
    })
    if (!closed) {
      const label = await dialogs.first().getAttribute('aria-label').catch(() => '')
      const text = (await dialogs.first().innerText().catch(() => '')).trim().slice(0, 300)
      throw new Error([
        '[run-cases] A visible app dialog has no current runtime dialog ID.',
        `Dialog: ${label || text || '(unlabeled dialog)'}`,
        'Agent action: refresh app context before running cases again.',
      ].join('\n'))
    }
    await dialogs.first().waitFor({ state: 'hidden', timeout: readyTimeout })
    handled += 1
  }
  throw new Error('[run-cases] Startup dialog did not close before timeout.')
}

async function openAssistantPanel(page) {
  const opened = await page.evaluate(() => {
    const store = window._appStore
    if (!store?.dispatch) return false
    store.dispatch({ type: 'ASSISTANT_PANEL_OPEN_CHANGED', isOpen: true })
    return true
  })
  if (!opened) throw new Error('[run-cases] AI Chat panel cannot be opened through the app runtime store.')
  await page.waitForFunction(() => {
    const isOpen = window._appStore?.getState?.()?.appRuntimeInfo?.isAssistantPanelOpen
    const panel = document.querySelector('.assistant-panel')
    return isOpen === true && panel && !panel.classList.contains('hide')
  }, { timeout: readyTimeout })
}

async function changeCasePage(page, testCase, isFirstCase) {
  if (isFirstCase) {
    await page.goto(testCase.pageUrl, { waitUntil: 'domcontentloaded', timeout: readyTimeout })
    return
  }

  const conversationBefore = await page.evaluate(() => ({
    threadId: window._assistantRuntime?.threadId || null,
    historyLength: window._assistantRuntime?.chatHistory?.length || 0,
  }))
  const changed = await page.evaluate((pageId) => {
    if (!window._urlManager?.changePage) return false
    window._urlManager.changePage(pageId)
    return true
  }, testCase.pageId)
  if (!changed) throw new Error('[run-cases] ExB URL manager is unavailable for SPA page navigation.')
  await page.waitForFunction(
    (pageId) => window._appStore?.getState?.()?.appRuntimeInfo?.currentPageId === pageId,
    testCase.pageId,
    { timeout: readyTimeout },
  )
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
  const conversationAfter = await page.evaluate(() => ({
    threadId: window._assistantRuntime?.threadId || null,
    historyLength: window._assistantRuntime?.chatHistory?.length || 0,
  }))
  if (
    conversationBefore.threadId &&
    (conversationAfter.threadId !== conversationBefore.threadId || conversationAfter.historyLength < conversationBefore.historyLength)
  ) {
    throw new Error('[run-cases] ExB SPA page navigation did not preserve the Assistant conversation.')
  }
}

async function readRuntime(page) {
  return page.evaluate((language) => {
    const runtime = window._assistantRuntime
    if (!runtime) return { available: false, transcript: null, snapshot: null }
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
      status: step?.status || null,
      retry: step?.retry ?? null,
      actionExecutionIds: step?.actionExecutionIds || [],
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
    const userInputs = (state.userInputs || []).map((input) => ({
      type: input?.type || null,
      content: contentText(input?.content),
      context: input?.context || null,
    }))
    const messages = (state.messages || []).map(pickMessage)
    const appManager = typeof window._am === 'function' ? window._am() : window._am
    const configuredWidgets = appManager?.appConfig?.widgets || {}
    const context = {
      visibleWidgets: (state.context?.visibleWidgets || []).map((widget) => {
        const widgetId = widget?.widgetId || widget?.id || null
        const configured = widgetId ? configuredWidgets[widgetId] : null
        return {
          widgetId,
          label: widget?.name || configured?.label || configured?.title || configured?.name || widgetId || null,
          type: widget?.type || configured?.type || null,
          uri: configured?.uri || null,
        }
      }),
      selectedDataSourceIds: state.context?.selectedDataSourceIds || [],
      aiRenderers: (state.context?.aiRenderers || []).map((renderer) => ({
        name: renderer?.name || null,
        description: renderer?.description || null,
      })),
    }
    const transcript = runtime.debugTranscript ?? null
    const snapshot = {
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
      historicalCompletedSteps: (state.historicalCompletedSteps || runtime.historicalCompletedSteps || []).map((step) => ({
        description: step?.description || null,
        agent: step?.agent || null,
        status: step?.status || null,
        output: step?.output ? {
          type: step.output.type || null,
          description: step.output.description || null,
          payload: contentText(step.output.payload),
        } : null,
        actionExecutionIds: step?.actionExecutionIds || [],
      })),
      context,
      evaluation: state.evaluation || null,
      suggestions: state.suggestions || [],
      aiRenderer: state.aiRenderer || null,
      transcript,
    }
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
      snapshot,
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
  const messagesBefore = before?.signal?.messageCount || 0
  const messagesAfter = runtime?.signal?.messageCount || 0
  const failedStep = (runtime?.completedSteps || []).slice(-1).find((step) => ['failed', 'failure', 'error'].includes(String(step?.status || '').toLowerCase()))
  if (failedStep) return 'failed'
  if (runtime?.isWorking === false && completedAfter > completedBefore) return 'completed'
  if (runtime?.isWorking === false && messagesAfter > messagesBefore && (runtime?.pendingSteps?.length || 0) === 0) return 'completed'
  return null
}

async function waitForTurn(page, before, deadline) {
  const trace = []
  let previousSignal = JSON.stringify(before.signal)
  while (true) {
    const runtime = await readRuntime(page)
    const changed = JSON.stringify(runtime.signal) !== JSON.stringify(before.signal)
    const signal = JSON.stringify(runtime.signal)
    if (signal !== previousSignal) {
      trace.push({ capturedAt: new Date().toISOString(), signal: runtime.signal, snapshot: runtime.snapshot })
      previousSignal = signal
    }
    const status = terminalStatus(runtime.transcript) || runtimeTerminalStatus(runtime, before)
    if (changed && status) return { ...runtime, status, trace }
    if (Date.now() >= deadline) return { ...runtime, status: 'timeout', trace }
    await page.waitForTimeout(500)
  }
}

async function waitForRenderer(page, runtime, deadline) {
  if (!runtime?.snapshot?.aiRenderer) return { status: 'not-requested' }

  let stableSignature = null
  let stableSince = null
  while (Date.now() < deadline) {
    const renderer = await page.evaluate(() => {
      const visit = (root, selector, matches = []) => {
        if (!root) return matches
        if (root.querySelectorAll) {
          matches.push(...root.querySelectorAll(selector))
          root.querySelectorAll('*').forEach((element) => {
            if (element.shadowRoot) visit(element.shadowRoot, selector, matches)
          })
        }
        return matches
      }
      const assistantMessage = visit(document, 'arcgis-assistant-message').at(-1)
      const container = assistantMessage ? visit(assistantMessage, '.chat-message-extra')[0] : null
      if (!container) {
        return { attached: false, loading: false, signature: null }
      }

      const loadingSelector = '.jimu-loading, .jimu-primary-loading, .jimu-secondary-loading, .donut-loading, .bar-loading, .dot-loading, .skeleton-loading'
      const inspect = (root) => {
        let loading = Boolean(root.matches?.(loadingSelector) || root.querySelector?.(loadingSelector))
        let html = root.innerHTML || ''
        root.querySelectorAll?.('*').forEach((element) => {
          if (element.shadowRoot) {
            const nested = inspect(element.shadowRoot)
            loading ||= nested.loading
            html += nested.html
          }
        })
        return { loading, html }
      }
      const state = inspect(container)
      const rect = container.getBoundingClientRect()
      return {
        attached: true,
        loading: state.loading,
        signature: `${state.html.length}:${Math.round(rect.width)}:${Math.round(rect.height)}:${container.textContent?.trim().length || 0}`,
      }
    }).catch(() => ({ attached: false, loading: false, signature: null }))

    if (renderer.attached && !renderer.loading) {
      if (renderer.signature !== stableSignature) {
        stableSignature = renderer.signature
        stableSince = Date.now()
      } else if (Date.now() - stableSince >= 1_000) {
        return { status: 'ready', signature: renderer.signature }
      }
    } else {
      stableSignature = null
      stableSince = null
    }
    await page.waitForTimeout(250)
  }
  return { status: 'timeout' }
}

async function writeCaseDebug(caseDir, caseInfo, runtime, turnRecords) {
  const lines = [
    `# AI Chat Debug: ${caseInfo.title || caseInfo.id}`,
    '',
    `- Case ID: ${caseInfo.id}`,
    `- Turns executed: ${turnRecords.length}`,
  ]
  appendDebugSection(lines, 'Case Context', [
    caseInfo.pageId ? `Page ID: ${caseInfo.pageId}` : null,
    caseInfo.pageTitle ? `Page: ${caseInfo.pageTitle}` : null,
  ])
  turnRecords.forEach((turn) => appendTurnDebug(lines, turn))
  if (!turnRecords.length) lines.push('', '## AI Information Flow', '', 'No user turn was executed, so no AI Chat information flow was captured.')
  if (runtime.error) lines.push('', `- Runtime read error: ${runtime.error}`)
  fs.writeFileSync(path.join(caseDir, 'case-debug.md'), lines.join('\n') + '\n')
  fs.writeFileSync(path.join(caseDir, 'case-debug.json'), JSON.stringify({
    case: {
      id: caseInfo.id,
      title: caseInfo.title || null,
      pageId: caseInfo.pageId || null,
      pageTitle: caseInfo.pageTitle || null,
    },
    turns: turnRecords.map((turn) => ({
      index: turn.index,
      prompt: turn.prompt,
      status: turn.status,
      runtimeStatus: turn.runtimeStatus || null,
      startedAt: turn.startedAt,
      endedAt: turn.endedAt || null,
      durationMs: turn.durationMs ?? null,
      error: turn.error || null,
      lifecycle: turn.lifecycle || null,
      runtimeBefore: turn.runtimeBefore?.snapshot || null,
      runtimeTrace: turn.runtimeAfter?.trace || [],
      runtimeAfter: turn.runtimeAfter?.snapshot || null,
      rendererWait: turn.runtimeAfter?.rendererWait || null,
    })),
    finalRuntime: runtime.snapshot || null,
  }, null, 2) + '\n')
}

function appendTurnDebug(lines, turn) {
  const before = turn.runtimeBefore || {}
  const runtime = turn.runtimeAfter || {}
  const transcriptTurn = Array.isArray(runtime.transcript) ? runtime.transcript.at(-1) : null
  const transcriptEntries = transcriptTurn?.entries || []
  const finalEntries = transcriptEntries.filter((entry) => entry?.section === 'final-result')
  const errorEntries = transcriptEntries.filter((entry) => entry?.section === 'error')
  const intermediateResults = transcriptEntries.filter((entry) => entry?.section === 'intermediate-result')
  const plannedSteps = newItems(before.plannedSteps, runtime.plannedSteps)
  const pendingSteps = newItems(before.pendingSteps, runtime.pendingSteps)
  const currentMessageId = runtime.userInputs?.at(-1)?.id || runtime.signal?.latestCompletedMessageId
  const completedSteps = currentMessageId
    ? (runtime.completedSteps || []).filter((step) => step.humanMessageId === currentMessageId)
    : newItems(before.completedSteps, runtime.completedSteps)
  const rendererSteps = completedSteps.filter((step) => /renderer|render/i.test(`${step.output?.type || ''} ${step.output?.description || ''} ${step.description || ''}`))
  const finalMessage = newItems(before.messages, runtime.messages)
    .reverse()
    .find((message) => message?.content && message.type !== 'human')
  const actionResponse = completedSteps
    .slice()
    .reverse()
    .find((step) => step.output?.payload)?.output?.payload || null
  const finalContent = finalEntries.at(-1)?.content || finalMessage?.content || actionResponse || null

  lines.push(
    '',
    `## Turn ${turn.index}`,
    `- Status: ${turn.status}${turn.runtimeStatus ? ` (${turn.runtimeStatus})` : ''}`,
    `- Duration: ${formatDuration(turn.durationMs)}`,
  )
  if (turn.error) lines.push(`- Runner error: ${turn.error}`)

  appendDebugSection(lines, 'User Prompt', [turn.prompt])
  appendDebugSection(lines, 'Execution Summary', formatExecutionSummary(runtime))
  appendDebugSection(lines, 'Renderer UI', [
    runtime.rendererWait?.status && runtime.rendererWait.status !== 'not-requested'
      ? `Renderer UI status: ${runtime.rendererWait.status}.`
      : null,
  ])

  appendDebugSection(lines, 'Reasoning and Plan', [
    runtime.planReason,
    runtime.reasoningMetadata?.status ? `Reasoning status: ${runtime.reasoningMetadata.status}` : null,
    ...plannedSteps.map((step) => formatStep(step, 'Planned')),
    ...pendingSteps.map((step) => formatStep(step, 'Pending')),
    ...transcriptEntries.filter((entry) => entry?.section === 'intermediate-reasoning').map((entry) => entry.content),
  ])
  appendDebugSection(lines, 'Intermediate Results', intermediateResults.map((entry) => (
    entry.title ? `${entry.title}: ${entry.content}` : entry.content
  )))
  const plannedDescriptions = new Set([...plannedSteps, ...pendingSteps].map((step) => step.description).filter(Boolean))
  appendDebugSection(lines, 'Sub-agents and Actions', completedSteps.map((step) => formatStep(step, 'Completed', {
    includeDescription: Boolean(step.description && !plannedDescriptions.has(step.description)),
  })))
  appendDebugSection(lines, 'Renderers', rendererSteps.map((step) => formatStep(step, 'Rendered')))
  appendDebugSection(lines, 'Agent Response', [finalContent || '(response not captured)'])
  appendDebugSection(lines, 'Errors', [turn.error, ...errorEntries.map((entry) => entry.content)])
}

function formatDuration(durationMs) {
  return typeof durationMs === 'number' ? `${(durationMs / 1000).toFixed(1)}s` : 'unknown'
}

function formatExecutionSummary(runtime = {}) {
  const signal = runtime.signal || {}
  const context = runtime.context || {}
  const evaluation = runtime.evaluation
  const lines = [
    `Runtime: ${runtime.runtimeReady === true ? 'ready' : 'not ready'}; working: ${runtime.isWorking === true ? 'yes' : 'no'}; stream epoch: ${runtime.streamEpoch ?? 'unknown'}.`,
    `Steps: planned ${runtime.plannedSteps?.length || 0}, pending ${runtime.pendingSteps?.length || 0}, completed ${runtime.completedSteps?.length || 0}.`,
    `Signals: messages ${signal.messageCount ?? 0}, user inputs ${signal.userInputCount ?? 0}, completed steps ${signal.completedStepCount ?? 0}.`,
    evaluation?.decision?.action ? `Evaluation: ${evaluation.decision.action}${evaluation.confidence !== undefined && evaluation.confidence !== null ? ` (confidence ${evaluation.confidence})` : ''}.` : null,
    context.selectedDataSourceIds?.length ? `Selected data sources: ${context.selectedDataSourceIds.join(', ')}.` : null,
    runtime.aiRenderer?.name ? `Selected renderer: ${runtime.aiRenderer.name}.` : null,
  ]
  return lines.filter(Boolean)
}

function newItems(before = [], after = []) {
  return (after || []).slice((before || []).length)
}

function appendDebugSection(lines, title, values) {
  const items = values.filter(Boolean)
  if (!items.length) return
  lines.push('', `### ${title}`, '')
  items.forEach((item) => {
    const [firstLine, ...rest] = String(item).split('\n')
    lines.push(`- ${firstLine}`, ...rest)
  })
}

function formatStep(step, state, options = {}) {
  const agent = step.agent ? `Agent ${step.agent}` : 'Agent unavailable'
  const description = step.description || 'No description'
  const stepOutput = step.output
  const statusText = step.status ? ` Status: ${step.status}.` : ''
  const retryText = step.retry ? ' Retried.' : ''
  const actionText = step.actionExecutionIds?.length ? ` Action executions: ${step.actionExecutionIds.join(', ')}.` : ''
  const descriptionText = options.includeDescription === false ? '' : `; ${description}`
  const outputText = stepOutput ? ` Output: ${stepOutput.type || 'result'}.` : ''
  return `${state}: ${agent}${descriptionText}.${statusText}${retryText}${actionText}${outputText}`
}

function stringifyDebugValue(value) {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value)
  } catch {
    return String(value)
  }
}

async function runCase(page, testCase, index) {
  const caseDir = path.join(runRoot, testCase.id || `case-${index + 1}`)
  fs.mkdirSync(caseDir, { recursive: true })
  const result = {
    id: testCase.id,
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
      const turnDeadline = turnStartedMs + turnTimeout
      const after = await waitForTurn(page, runtime, turnDeadline)
      after.rendererWait = await waitForRenderer(page, after, turnDeadline)
      if (after.status !== 'timeout' && after.rendererWait.status === 'timeout') after.status = 'timeout'
      runtime = after
      turn.runtimeAfter = after
      turn.runtimeStatus = after.status
      turn.debugText = after.debugText || ''
      turn.status = after.status
      turn.endedAt = new Date().toISOString()
      if (after.status === 'timeout') {
        turn.error = after.rendererWait?.status === 'timeout'
          ? `AI renderer did not finish within the ${Math.round(turnTimeout / 1000)} second turn limit; the case was stopped and the next case will continue.`
          : `Turn exceeded the ${Math.round(turnTimeout / 1000)} second limit; the case was stopped and the next case will continue.`
        console.log(`[run-cases] Turn ${turn.index} exceeded ${Math.round(turnTimeout / 1000)}s; stopping case ${testCase.id}.`)
        turn.status = 'timeout'
      }
      const screenshotName = `turn-${String(turnIndex + 1).padStart(2, '0')}${turn.error ? '-error' : ''}.png`
      await page.screenshot({ path: path.join(caseDir, screenshotName), fullPage: true })
    } catch (error) {
      turn.error = error.message
      turn.runtimeAfter = await readRuntime(page)
      turn.runtimeStatus = turn.runtimeAfter.status || null
      turn.debugText = turn.runtimeAfter.debugText || ''
      turn.endedAt = new Date().toISOString()
      turn.lifecycle = page._caseLifecycle
      await page.screenshot({ path: path.join(caseDir, `turn-${String(turnIndex + 1).padStart(2, '0')}-error.png`), fullPage: true }).catch(() => {})
    }
    turn.durationMs = Date.now() - turnStartedMs
    turnRecords.push(turn)
    result.turns.push({
      index: turn.index,
      prompt: turn.prompt,
      status: turn.status,
      runtimeStatus: turn.runtimeStatus || null,
      startedAt: turn.startedAt,
      endedAt: turn.endedAt || null,
      durationMs: turn.durationMs,
      error: turn.error || null,
      lifecycle: turn.lifecycle || null,
      screenshot: `turn-${String(turn.index).padStart(2, '0')}${turn.error ? '-error' : ''}.png`,
    })
    fs.writeFileSync(path.join(caseDir, 'result.json'), JSON.stringify(result, null, 2) + '\n')
    if (turn.status === 'timeout') break
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

const contextOptions = { ignoreHTTPSErrors: true }
contextOptions.viewport = getViewport(config.startup?.viewport || 'desktop')
let context = null
if (cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true })
  context = await chromium.launchPersistentContext(cacheDir, {
    ...contextOptions,
    headless: mode === 'headless',
  })
  console.log(`[run-cases] Reusing browser cache: ${cacheDir}`)
}
const results = []
const existingPages = context.pages()
const page = existingPages[0] || await context.newPage()
await Promise.all(existingPages.slice(1).map(async (extraPage) => extraPage.close()))
try {
  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index]
    const lifecycle = { pageCrashed: false, pageClosed: false, contextClosed: false, consoleErrors: [], requestFailures: [] }
    page._caseLifecycle = lifecycle
    const onCrash = () => { lifecycle.pageCrashed = true }
    const onPageClose = () => { lifecycle.pageClosed = true }
    const onContextClose = () => { lifecycle.contextClosed = true }
    const onConsole = (message) => {
      if (message.type() === 'error' && lifecycle.consoleErrors.length < 20) lifecycle.consoleErrors.push(message.text())
    }
    const onRequestFailed = (request) => {
      if (lifecycle.requestFailures.length < 20) lifecycle.requestFailures.push({ url: request.url(), error: request.failure()?.errorText || null })
    }
    page.on('crash', onCrash)
    page.on('close', onPageClose)
    context.on('close', onContextClose)
    page.on('console', onConsole)
    page.on('requestfailed', onRequestFailed)
    try {
      await changeCasePage(page, testCase, index === 0)
      await inspectSession(page)
      await dismissBlockingModals(page)
      if (index === 0) await page.waitForLoadState('networkidle', { timeout: 0 })
      await openAssistantPanel(page)
      const ready = await findVisibleLocator(page, selectors.ready, readyTimeout)
      if (!ready) throw new Error('Chat input was not visible using the built-in Playwright locators.')
      await ready.waitFor({ state: 'visible', timeout: readyTimeout })
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
        lifecycle,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        handoffFailure: true,
      }
      await page.screenshot({ path: path.join(caseDir, 'startup-error.png'), fullPage: true }).catch(() => {})
      fs.writeFileSync(path.join(caseDir, 'result.json'), JSON.stringify(result, null, 2) + '\n')
      fs.writeFileSync(path.join(caseDir, 'case-debug.md'), [
        `# AI Chat Debug: ${testCase.title || testCase.id}`,
        '',
        '## AI Information Flow',
        '',
        'No user turn was executed, so no AI Chat information flow was captured.',
        '',
        '### Startup Error',
        '',
        `- ${message.split('\n')[0]}`,
        '',
        '### Lifecycle Evidence',
        '',
        `- Page crashed: ${lifecycle.pageCrashed}`,
        `- Page closed: ${lifecycle.pageClosed}`,
        `- Context closed: ${lifecycle.contextClosed}`,
        ...(lifecycle.consoleErrors.length ? [`- Console errors: ${lifecycle.consoleErrors.join(' | ')}`] : []),
        ...(lifecycle.requestFailures.length ? [`- Request failures: ${lifecycle.requestFailures.map((failure) => `${failure.url} (${failure.error || 'unknown'})`).join(' | ')}`] : []),
      ].join('\n') + '\n')
      results.push(result)
      if (error?.code === 'SESSION_INVALID') break
    } finally {
      page.off('crash', onCrash)
      page.off('close', onPageClose)
      context.off('close', onContextClose)
      page.off('console', onConsole)
      page.off('requestfailed', onRequestFailed)
    }
  }
} finally {
  await page.close().catch(() => {})
  await context.close()
}

const summary = {
  config: configPath,
  url: config.url,
  mode,
  cache: cacheDir ? { enabled: true, directory: cacheDir } : { enabled: false },
  startedAt: results[0]?.startedAt || new Date().toISOString(),
  endedAt: new Date().toISOString(),
  total: results.length,
  passed: results.filter((result) => result.status === 'completed').length,
  failed: results.filter((result) => result.status === 'failed').length,
  cases: results.map(({ id, status }) => ({
    id,
    status,
    directory: id || null,
  })),
}
fs.writeFileSync(path.join(runRoot, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(`[run-cases] Wrote artifacts to ${runRoot}`)
process.exitCode = summary.failed ? 2 : 0
