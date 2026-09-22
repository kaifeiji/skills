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
const storageStateIndex = args.indexOf('--storage-state')
const storageState = storageStateIndex === -1
  ? process.env.STORAGE_STATE || 'config/.auth/local-exb.json'
  : args[storageStateIndex + 1]

if (!appUrl) {
  console.error('Usage: node tooling/prepare-config-and-prompts.mjs <app-url> [output-file] --storage-state <path>')
  console.error('Example: node tooling/prepare-config-and-prompts.mjs https://example.com/experience/demo config/app.json --storage-state config/.auth/local-exb.json')
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
try {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await waitForNetworkIdle(page)
  appTitle = await page.title()
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
  ...(storageState ? { storageState: path.resolve(storageState) } : {}),
  startup: {
    openChat: true,
    viewport: 'desktop-large',
    waitForReady: true,
    requireVisibleChat: true,
  },
  suite: {
    suiteName: `${appSlug}-baseline`,
    appSlug: appSlug,
    generatedAt: new Date().toISOString(),
    sourceNotes: [
      'Generated from the app URL and app description.',
      'Prompt cases are meant to be realistic, multi-turn, and grounded in real app state.'
    ],
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

async function waitForNetworkIdle(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 30_000 })
  } catch {
    console.log('[prepare-config-and-prompts] Network idle was not reached; continuing after the bounded wait.')
  }
}
