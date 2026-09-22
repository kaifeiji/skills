#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'

const require = createRequire(path.join(process.cwd(), 'package.json'))
const { chromium } = require('@playwright/test')

const args = process.argv.slice(2)
const appUrl = args[0]
const outputArg = args[1]
const languageIndex = args.indexOf('--language')
const language = languageIndex === -1
  ? process.env.TEST_LANGUAGE || 'en'
  : args[languageIndex + 1]
const storageStateIndex = args.indexOf('--storage-state')
const storageState = storageStateIndex === -1
  ? process.env.STORAGE_STATE || 'config/.auth/local-exb.json'
  : args[storageStateIndex + 1]

if (!appUrl) {
  console.error('Usage: node tooling/prepare-config-and-prompts.mjs <app-url> [output-file] --storage-state <path> --language <en|zh>')
  console.error('Example: node tooling/prepare-config-and-prompts.mjs https://example.com/experience/demo config/app.json --storage-state config/.auth/local-exb.json')
  process.exit(1)
}

if (!['en', 'zh'].includes(language)) {
  console.error('[prepare-config-and-prompts] --language must be en or zh')
  process.exit(1)
}

if (!storageState) {
  console.error('[prepare-config-and-prompts] Session handoff incomplete: provide --storage-state from capture-session.mjs.')
  process.exit(1)
}
if (!fs.existsSync(path.resolve(storageState))) {
  console.error(`[prepare-config-and-prompts] Session handoff incomplete: storage state not found at ${path.resolve(storageState)}`)
  process.exit(1)
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  ...(storageState ? { storageState: path.resolve(storageState) } : {}),
})
const page = await context.newPage()
let appTitle
let appContext
try {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await waitForNetworkIdle(page)
  appTitle = await page.title()
  appContext = await readAppContext(page)
  const pageAccess = await checkAccessiblePages(context, appUrl, appContext.pages)
  appContext.pages = pageAccess.accessible
  appContext.inaccessiblePages = pageAccess.inaccessible
} finally {
  await context.close()
  await browser.close()
}

const appSlug = slugify(appTitle)
const output = outputArg || `config/${appSlug}.json`

const outDir = path.dirname(output)
fs.mkdirSync(outDir, { recursive: true })

const config = {
  slug: appSlug,
  url: appUrl,
  language,
  ...(storageState ? { storageState: path.resolve(storageState) } : {}),
  startup: {
    openChat: true,
    viewport: 'desktop-large',
    requireVisibleChat: true,
  },
  appContext,
  suite: {
    cases: []
  }
}

fs.writeFileSync(output, JSON.stringify(config, null, 2) + '\n')
console.log(`[prepare-config-and-prompts] Wrote config to: ${output}`)
console.log(`[prepare-config-and-prompts] App title: ${appTitle}`)
console.log(`[prepare-config-and-prompts] Generated app slug: ${appSlug}`)
console.log('[prepare-config-and-prompts] Agent handoff required: add and review suite.cases before script execution.')

function slugify(title) {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'app'
}

async function readAppContext(page) {
  return page.evaluate(() => {
    const clip = (value, limit = 12_000) => {
      if (typeof value !== 'string') return value
      return value.length > limit ? `${value.slice(0, limit)}...[truncated]` : value
    }
    const summarize = (value, depth = 0) => {
      if (depth > 3) return '[nested]'
      if (Array.isArray(value)) return value.slice(0, 100).map((item) => summarize(item, depth + 1))
      if (!value || typeof value !== 'object') return clip(value)
      return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [
        key,
        typeof item === 'function' ? '[function]' : summarize(item, depth + 1),
      ]))
    }
    const appManager = typeof window._am === 'function' ? window._am() : window._am
    const dataSourceManager = window._dataSourceManager
    const appConfig = appManager?.appConfig || {}
    const rawPages = appConfig.pages || {}
    const layouts = appConfig.layouts || {}
    const widgets = appConfig.widgets || {}
    const pageCandidates = []
    const visitPages = (value, parentId = null, entryId = null) => {
      if (Array.isArray(value)) return value.forEach((item) => visitPages(item, parentId))
      if (!value || typeof value !== 'object') return
      const id = value.id || value.pageId || value.name || value.uri || entryId || null
      const path = value.path || value.url || value.uri || null
      if (id || path) pageCandidates.push({
        id,
        parentId,
        title: value.label || value.title || value.name || id,
        path,
        largeLayoutId: value.layout && value.layout.LARGE ? value.layout.LARGE : null,
      })
      if (value.pages) visitPages(value.pages, id || parentId)
      if (value.children) visitPages(value.children, id || parentId)
      if (!value.id && !value.pageId && !value.path && !value.url && !value.uri && !value.pages && !value.children) {
        Object.entries(value).forEach(([key, item]) => visitPages(item, parentId, key))
      }
    }
    visitPages(rawPages)
    const dataSources = dataSourceManager?.dataSources || {}
    const collectWidgetIds = (value, ids = new Set()) => {
      if (Array.isArray(value)) value.forEach((item) => collectWidgetIds(item, ids))
      else if (value && typeof value === 'object') {
        if (typeof value.widgetId === 'string') ids.add(value.widgetId)
        Object.values(value).forEach((item) => collectWidgetIds(item, ids))
      }
      return ids
    }
    const collectChildren = (ids) => {
      let changed = true
      while (changed) {
        changed = false
        Object.entries(widgets).forEach(([id, widget]) => {
          const parent = widget?.parent
          const parentId = typeof parent === 'string' ? parent : parent?.id
          if (parentId && ids.has(parentId) && !ids.has(id)) {
            ids.add(id)
            changed = true
          }
        })
      }
      return ids
    }
    const extractReferences = (value, references = {}, keyPath = '') => {
      if (Array.isArray(value)) return value.forEach((item, index) => extractReferences(item, references, `${keyPath}[${index}]`))
      if (!value || typeof value !== 'object') return
      Object.entries(value).forEach(([key, item]) => {
        const path = keyPath ? `${keyPath}.${key}` : key
        if (/(dataSource|webMap|mapWidget|mapView|itemId|layerId)/i.test(key)) {
          if (!references[key]) references[key] = []
          if (references[key].length < 50) references[key].push(summarize(item, 2))
        }
        extractReferences(item, references, path)
      })
    }
    pageCandidates.forEach((page) => {
      const ids = collectChildren(collectWidgetIds(layouts[page.largeLayoutId] || {}))
      page.widgets = [...ids].map((id) => {
        const widget = widgets[id] || {}
        const references = {}
        extractReferences(widget.config || {}, references)
        extractReferences(widget.useDataSources || [], references)
        return {
          id,
          label: widget.label || id,
          uri: widget.uri || null,
          useDataSources: summarize(widget.useDataSources || [], 2),
          useMapWidgetIds: summarize(widget.useMapWidgetIds || [], 2),
          references,
        }
      })
    })
    return {
      pages: pageCandidates,
      dataSources: summarize(dataSources),
      visibleWidgets: summarize(appManager?.widgetsRuntimeInfo || {}),
      accessCheck: 'Each page must be opened and checked for a reachable URL and visible page content before a case is generated.',
    }
  })
}

async function checkAccessiblePages(context, baseUrl, pages) {
  const candidates = Array.isArray(pages) ? pages : []
  const accessible = []
  const inaccessible = []
  for (const candidate of candidates) {
    const target = resolvePageUrl(baseUrl, candidate.path)
    if (!target) {
      inaccessible.push({ ...candidate, reason: 'No navigable page URL or path was found.' })
      continue
    }
    const probe = await context.newPage()
    try {
      const response = await probe.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await waitForNetworkIdle(probe)
      const bodyLength = await probe.locator('body').innerText().then((text) => text.trim().length).catch(() => 0)
      const status = response?.status() || 0
      if (status >= 400 || bodyLength === 0) {
        inaccessible.push({ ...candidate, url: target, reason: `Page was not usable (HTTP ${status || 'unknown'}, body length ${bodyLength}).` })
      } else {
        accessible.push({ ...candidate, url: target, bodyLength })
      }
    } catch (error) {
      inaccessible.push({ ...candidate, url: target, reason: error.message })
    } finally {
      await probe.close()
    }
  }
  return { accessible, inaccessible }
}

function resolvePageUrl(baseUrl, pagePath) {
  if (!pagePath || pagePath === '#') return null
  try {
    return new URL(pagePath, baseUrl).toString()
  } catch {
    return null
  }
}

async function waitForNetworkIdle(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 30_000 })
  } catch {
    console.log('[prepare-config-and-prompts] Network idle was not reached; continuing after the bounded wait.')
  }
}
