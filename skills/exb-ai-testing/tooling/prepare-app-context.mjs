#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { loadPlaywright } from './load-playwright.mjs'
import { getViewport } from './viewport-utils.mjs'

const { chromium } = loadPlaywright()

const args = process.argv.slice(2)
const positionalArgs = args.filter((argument, index) => (
  !argument.startsWith('--') && !args[index - 1]?.startsWith('--')
))
const appUrl = positionalArgs[0]
const outputArg = positionalArgs[1]
const languageIndex = args.indexOf('--language')
const language = languageIndex === -1
  ? process.env.TEST_LANGUAGE || 'en'
  : args[languageIndex + 1]
const cacheIndex = args.indexOf('--cache-dir')
const cacheDir = path.resolve(cacheIndex === -1 ? path.join('.cache', 'browser-profile') : args[cacheIndex + 1])
const viewportIndex = args.indexOf('--viewport')
const viewportName = viewportIndex === -1 ? 'desktop' : args[viewportIndex + 1]
const headlessIndex = args.indexOf('--headless')
const headless = headlessIndex === -1 ? true : args[headlessIndex + 1] !== 'false'
const appContextTimeoutIndex = args.indexOf('--app-context-timeout')
const appContextTimeout = appContextTimeoutIndex === -1 ? 90_000 : Number(args[appContextTimeoutIndex + 1])
const viewport = getViewport(viewportName)

if (!appUrl) {
  console.error('Usage: node tooling/prepare-app-context.mjs <app-url> [output-file] [--cache-dir <dir>] [--viewport desktop|pad|mobile] --language <en|zh>')
  console.error('Example: node tooling/prepare-app-context.mjs https://example.com/experience/demo --language en')
  process.exit(1)
}

if (!['en', 'zh'].includes(language)) {
  console.error('[prepare-app-context] --language must be en or zh')
  process.exit(1)
}

fs.mkdirSync(cacheDir, { recursive: true })
const context = await chromium.launchPersistentContext(cacheDir, {
  headless: headless,
  ignoreHTTPSErrors: true,
  viewport,
})
const page = await context.newPage()
let appTitle
let appContext
try {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await requireValidSession(page)
  await waitForAppContext(page)
  const loadedDataSources = await loadConfiguredDataSources(page)
  appTitle = await page.title()
  appContext = await readAppContext(page, appUrl, loadedDataSources)
} finally {
  await context.close()
}

const { appSlug, output } = resolveConfigTarget(slugify(appTitle), outputArg)

const outDir = path.dirname(output)
fs.mkdirSync(outDir, { recursive: true })

const config = {
  slug: appSlug,
  url: appUrl,
  language,
  startup: {
    viewport: viewportName,
  },
  appContext,
  suite: {
    cases: []
  }
}

fs.writeFileSync(output, JSON.stringify(omitEmptyValues(config), null, 2) + '\n')
console.log(`[prepare-app-context] Wrote config to: ${output}`)
console.log(`[prepare-app-context] App title: ${appTitle}`)
console.log(`[prepare-app-context] Generated app slug: ${appSlug}`)
console.log('[prepare-app-context] Agent handoff required: add and review suite.cases before script execution.')

async function requireValidSession(page) {
  await page.waitForFunction(() => Boolean(window._sessionManager), null, { timeout: 60_000 })
  await page.waitForFunction(
    () => Boolean(window._sessionManager?.getMainSession?.()),
    null,
    { timeout: 60_000 },
  ).catch(() => {})
  const sessionState = await page.evaluate(() => {
    const sessionManager = window._sessionManager
    if (sessionManager.getMainSession()) return 'signed-in'
    return sessionManager.isMainSessionExpired() ? 'expired' : 'signed-out'
  })
  if (sessionState !== 'signed-in') {
    throw new Error(`[prepare-app-context] App session is ${sessionState}. Run probe-session.mjs and complete sign-in before collecting context.`)
  }
}

async function loadConfiguredDataSources(page) {
  await page.waitForFunction(() => Boolean(window._dataSourceManager), null, { timeout: 60_000 })
  return page.evaluate(async () => {
    const manager = window._dataSourceManager
    const appManager = typeof window._am === 'function' ? window._am() : window._am
    const configured = appManager?.appConfig?.dataSources || {}
    let loadError = null
    let timer
    try {
      await Promise.race([
        manager.createAllDataSources(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Data source creation exceeded 90 seconds.')), 90_000)
        }),
      ])
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error)
    } finally {
      clearTimeout(timer)
    }

    const summarizeFields = (dataSource) => Object.values(dataSource?.getSchema?.()?.fields || {})
      .map((field) => ({
        name: field?.name || field?.jimuName || null,
        alias: field?.alias || null,
        type: field?.type || null,
        esriType: field?.esriType || null,
      }))
      .filter((field) => field.name)
      .sort((left, right) => left.name.localeCompare(right.name))
    const summarizeInstance = (dataSource) => ({
      id: dataSource?.id || null,
      label: dataSource?.getLabel?.() || dataSource?.getDataSourceJson?.()?.sourceLabel || dataSource?.id || null,
      type: dataSource?.type || dataSource?.getDataSourceJson?.()?.type || null,
      fields: summarizeFields(dataSource),
    })

    return Object.entries(configured).map(([rootId, definition]) => {
      const root = manager.getDataSource(rootId)
      const layers = root?.isDataSourceSet?.() ? (root.getAllChildDataSources?.() || []) : []
      return {
        id: rootId,
        label: root?.getLabel?.() || definition?.label || definition?.sourceLabel || rootId,
        type: root?.type || definition?.type || null,
        itemId: definition?.itemId || null,
        portalUrl: definition?.portalUrl || null,
        loadStatus: root ? 'loaded' : 'unavailable',
        fields: summarizeFields(root),
        layers: layers
          .filter((layer) => !layer?.dataViewId && !layer?.localId)
          .map(summarizeInstance)
          .filter((layer) => layer.id)
          .sort((left, right) => left.id.localeCompare(right.id)),
        ...(loadError ? { loadWarning: loadError } : {}),
      }
    })
  })
}

function slugify(title) {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'app'
}

function omitEmptyValues(value) {
  if (Array.isArray(value)) {
    const items = value.map(omitEmptyValues).filter((item) => item !== undefined)
    return items.length ? items : undefined
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, omitEmptyValues(item)])
      .filter(([, item]) => item !== undefined)
    return entries.length ? Object.fromEntries(entries) : undefined
  }
  return value === null || value === undefined || value === '' ? undefined : value
}

function resolveConfigTarget(baseSlug, outputArg) {
  const requestedOutput = path.resolve(outputArg || path.join('config', `${baseSlug}.json`))
  const outputDir = path.dirname(requestedOutput)
  const extension = path.extname(requestedOutput) || '.json'
  const outputStem = path.basename(requestedOutput, extension)
  const appSlug = nextAvailableSlug(baseSlug, outputDir)
  const output = outputArg
    ? nextAvailableFile(outputDir, outputStem, extension)
    : path.join(outputDir, `${appSlug}${extension}`)
  return { appSlug, output }
}

function nextAvailableSlug(baseSlug, configDir) {
  let sequence = 1
  while (true) {
    const slug = withSequence(baseSlug, sequence)
    const defaultConfig = path.join(configDir, `${slug}.json`)
    if (!fs.existsSync(defaultConfig) && !configSlugExists(configDir, slug)) return slug
    sequence += 1
  }
}

function nextAvailableFile(directory, stem, extension) {
  let sequence = 1
  while (true) {
    const output = path.join(directory, `${withSequence(stem, sequence)}${extension}`)
    if (!fs.existsSync(output)) return output
    sequence += 1
  }
}

function withSequence(value, sequence) {
  return `${value}-${String(sequence).padStart(2, '0')}`
}

function configSlugExists(configDir, slug) {
  if (!fs.existsSync(configDir)) return false
  return fs.readdirSync(configDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .some((entry) => {
      try {
        const config = JSON.parse(fs.readFileSync(path.join(configDir, entry.name), 'utf8'))
        return config.slug === slug
      } catch {
        return false
      }
    })
}

async function readAppContext(page, appUrl, loadedDataSources) {
  return page.evaluate(({ appUrl, loadedDataSources }) => {
    const summarizeDataSources = (sources) => Object.values(sources || {})
      .map((source) => {
        const definition = source?.dataSourceJson || source?.originDataSourceJson || source || {}
        return {
          id: source?.id || definition.id || null,
          label: source?.label || definition.label || definition.sourceLabel || null,
          type: source?.type || definition.type || null,
          itemId: source?.itemId || definition.itemId || null,
          portalUrl: source?.portalUrl || definition.portalUrl || null,
        }
      })
      .filter((source) => source.id)
      .sort((left, right) => left.id.localeCompare(right.id))
    const summarizeUseDataSources = (sources) => (Array.isArray(sources) ? sources : [])
      .map((source) => ({
        dataSourceId: source?.dataSourceId || null,
        mainDataSourceId: source?.mainDataSourceId || null,
        rootDataSourceId: source?.rootDataSourceId || null,
      }))
      .filter((source) => source.dataSourceId || source.mainDataSourceId || source.rootDataSourceId)
    const appManager = typeof window._am === 'function' ? window._am() : window._am
    const appConfig = appManager?.appConfig || {}
    const rawPages = appConfig.pages || {}
    const layouts = appConfig.layouts || {}
    const widgets = appConfig.widgets || {}
    const pageCandidates = []
    const visitPages = (value, parentId = null, entryId = null) => {
      if (Array.isArray(value)) return value.forEach((item) => visitPages(item, parentId))
      if (!value || typeof value !== 'object') return
      const id = value.id || value.pageId || value.name || value.uri || entryId || null
      const label = value.label || value.title || value.name || id
      if (id && value.isVisible !== false) pageCandidates.push({
        id,
        title: label,
        largeLayoutId: value.layout && value.layout.LARGE ? value.layout.LARGE : null,
      })
      if (value.pages) visitPages(value.pages, id || parentId)
      if (value.children) visitPages(value.children, id || parentId)
      if (!value.id && !value.pageId && !value.path && !value.url && !value.uri && !value.pages && !value.children) {
        Object.entries(value).forEach(([key, item]) => visitPages(item, parentId, key))
      }
    }
    visitPages(rawPages)
    const dataSources = appConfig.dataSources || {}
    const collectWidgetIds = (value, ids = new Set()) => {
      if (Array.isArray(value)) value.forEach((item) => collectWidgetIds(item, ids))
      else if (value && typeof value === 'object') {
        if (typeof value.widgetId === 'string') ids.add(value.widgetId)
        Object.values(value).forEach((item) => collectWidgetIds(item, ids))
      }
      return ids
    }
    const widgetChildLayoutIds = (id) => Object.entries(layouts)
      .filter(([, layout]) => layout?.parent?.type === 'widget' && layout.parent.id === id)
      .map(([layoutId]) => layoutId)
    const layoutItemsInOrder = (layout) => {
      const order = Array.isArray(layout?.order) ? layout.order : Object.keys(layout?.content || {})
      return order.map((itemId) => layout?.content?.[itemId]).filter(Boolean)
    }
    const buildTocLayout = (layoutId, visited = new Set()) => {
      const layout = layouts[layoutId]
      if (!layout || visited.has(layoutId)) return null
      const nextVisited = new Set(visited).add(layoutId)
      const children = layoutItemsInOrder(layout).map((item) => {
        const itemId = item.id || null
        const itemChildren = []
        if (item.widgetId) {
          const widget = widgets[item.widgetId] || {}
          widgetChildLayoutIds(item.widgetId).forEach((childLayoutId) => {
            const childLayout = buildTocLayout(childLayoutId, nextVisited)
            if (childLayout) itemChildren.push(...(childLayout.children || []))
          })
          return {
            type: 'widget',
            id: item.widgetId,
            label: widget.label || item.widgetId,
            layoutId,
            layoutItemId: itemId,
            ...(itemChildren.length ? { children: itemChildren } : {}),
          }
        }
        if (item.sectionId) {
          return { type: 'section', id: item.sectionId, layoutId, layoutItemId: itemId }
        }
        if (item.screenGroupId) {
          return { type: 'screenGroup', id: item.screenGroupId, layoutId, layoutItemId: itemId }
        }
        return { type: 'layoutItem', id: itemId, label: item.type || itemId, layoutId, layoutItemId: itemId }
      })
      return {
        type: 'layout',
        id: layoutId,
        label: layout.label || layout.type || layoutId,
        layoutId,
        children,
      }
    }
    const summarizeWidget = (id, visited = new Set()) => {
      const widget = widgets[id] || {}
      if (visited.has(id)) return { id, label: widget.label || id, uri: widget.uri || null }
      const nextVisited = new Set(visited).add(id)
      const childIds = [...new Set(widgetChildLayoutIds(id).flatMap(widgetIdsForLayout))]
      return {
        id,
        label: widget.label || id,
        uri: widget.uri || null,
        useDataSources: summarizeUseDataSources(widget.useDataSources),
        useMapWidgetIds: Array.isArray(widget.useMapWidgetIds) ? widget.useMapWidgetIds.filter((id) => typeof id === 'string') : [],
        ...(childIds.length ? { widgets: childIds.filter((childId) => childId !== id).map((childId) => summarizeWidget(childId, nextVisited)) } : {}),
      }
    }
    const collectSectionIds = (value, ids = new Set()) => {
      if (Array.isArray(value)) value.forEach((item) => collectSectionIds(item, ids))
      else if (value && typeof value === 'object') {
        if (typeof value.sectionId === 'string') ids.add(value.sectionId)
        Object.values(value).forEach((item) => collectSectionIds(item, ids))
      }
      return ids
    }
    const getLayoutId = (container) => container?.layout?.LARGE || container?.layout || null
    const widgetIdsForLayout = (layoutId) => [...collectWidgetIds(layouts[layoutId] || {})]
    const summarizeSurface = (layoutId) => {
      const widgetIds = widgetIdsForLayout(layoutId)
      return {
        widgets: widgetIds.map((id) => summarizeWidget(id)),
      }
    }
    const dialogs = Object.entries(appConfig.dialogs || {}).map(([id, dialog]) => ({
      id,
      label: dialog?.label || dialog?.title || dialog?.name || id,
      ...(dialog?.isSplash ? { opensAtStartup: true } : {}),
      ...summarizeSurface(getLayoutId(dialog)),
    }))
    pageCandidates.forEach((page) => {
      const sectionIds = collectSectionIds(layouts[page.largeLayoutId] || {})
      const pageSurface = summarizeSurface(page.largeLayoutId)
      page.widgets = pageSurface.widgets
      page.views = [...sectionIds].flatMap((sectionId) => {
        const section = appConfig.sections?.[sectionId] || {}
        const viewIds = Array.isArray(section.views) ? section.views : Object.keys(appConfig.views || {}).filter((viewId) => appConfig.views[viewId]?.sectionId === sectionId)
        return viewIds.map((viewId) => {
          const view = appConfig.views?.[viewId] || {}
          const layoutId = getLayoutId(view)
          const viewSurface = summarizeSurface(layoutId)
          return {
            id: viewId,
            label: view.label || view.title || viewId,
            widgets: viewSurface.widgets,
          }
        })
      })
      delete page.largeLayoutId
    })
    const referencedDataSourceIds = new Set()
    const collectReferencedDataSources = (value) => {
      if (Array.isArray(value)) {
        value.forEach(collectReferencedDataSources)
      } else if (value && typeof value === 'object') {
        if (Array.isArray(value.useDataSources)) {
          value.useDataSources.forEach((source) => {
            ;['dataSourceId', 'mainDataSourceId', 'rootDataSourceId'].forEach((key) => {
              if (typeof source?.[key] === 'string' && source[key]) referencedDataSourceIds.add(source[key])
            })
          })
        }
        Object.values(value).forEach(collectReferencedDataSources)
      }
    }
    collectReferencedDataSources({ pages: pageCandidates, dialogs })
    const loadedDataSourcesById = new Map((loadedDataSources || []).map((source) => [source.id, source]))
    const summarizedDataSourcesById = new Map(summarizeDataSources(dataSources).map((source) => [source.id, source]))
    const referencedRootDataSourceIds = new Set()
    referencedDataSourceIds.forEach((id) => {
      const loadedRoot = (loadedDataSources || []).find((source) => source.id === id || source.layers?.some((layer) => layer.id === id))
      referencedRootDataSourceIds.add(loadedRoot?.id || id)
    })
    const strings = [...new Set((document.body?.innerText || '')
      .split(/\r?\n/)
      .map((text) => text.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map((text) => text.length > 500 ? `${text.slice(0, 500)}...[truncated]` : text))]
      .slice(0, 500)
    return {
      app: {
        title: appConfig?.attributes?.title || document.title || null,
      },
      header: summarizeSurface(getLayoutId(appConfig.header)),
      footer: summarizeSurface(getLayoutId(appConfig.footer)),
      dialogs,
      pages: pageCandidates,
      dataSources: [...referencedRootDataSourceIds]
        .map((id) => loadedDataSourcesById.get(id) || summarizedDataSourcesById.get(id))
        .filter(Boolean)
        .sort((left, right) => left.id.localeCompare(right.id)),
      strings,
    }
  }, { appUrl, loadedDataSources })
}

async function waitForAppContext(page) {
  try {
    await page.waitForFunction(() => {
      const appManager = typeof window._am === 'function' ? window._am() : window._am
      return Object.keys(appManager?.appConfig?.widgets || {}).length > 0
    }, { timeout: appContextTimeout })
  } catch {
    try {
      const tmpDir = '.tmp'
      fs.mkdirSync(tmpDir, { recursive: true })
      const snapshotPath = path.join(tmpDir, `prepare-app-context-${Date.now()}.html`)
      const content = await page.content()
      fs.writeFileSync(snapshotPath, content, 'utf8')
      console.log(`[prepare-app-context] Experience Builder runtime was not ready after ${appContextTimeout}ms; saved page snapshot to: ${snapshotPath}`)
    } catch (err) {
      console.log('[prepare-app-context] Failed to save page snapshot after timeout.', err?.message || err)
    }
  }
}
