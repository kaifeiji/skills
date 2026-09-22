#!/usr/bin/env node

import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin as input, stdout as outputStream } from 'node:process'

const args = process.argv.slice(2)
const url = args[0] || process.env.AUTH_URL
const output = args[1] || process.env.STORAGE_STATE || 'config/.auth/local-exb.json'

if (!url) {
  console.error('Usage: node tooling/capture-session.mjs <app-url> [output-path]')
  console.error('Example: node tooling/capture-session.mjs https://example.com/experience/demo config/.auth/local-exb.json')
  process.exit(1)
}

console.log('[capture-session] Complete sign-in in this Playwright Chromium window; it is the session source for prompt preparation and case execution.')

const outDir = path.dirname(output)
fs.mkdirSync(outDir, { recursive: true })

console.log(`[capture-session] Opening visible browser for: ${url}`)
console.log(`[capture-session] Saving authenticated state to: ${output}`)

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ ignoreHTTPSErrors: true })
const page = await context.newPage()

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  console.log('[capture-session] Sign in and complete any required app flow in the visible browser.')
  console.log('[capture-session] Press Enter in this terminal when the app is ready and the session is valid.')

  const rl = readline.createInterface({ input, output: outputStream })
  await rl.question('Ready to save storage state? ')
  rl.close()

  await context.storageState({ path: output })
  console.log(`[capture-session] Saved authenticated state to: ${output}`)
} finally {
  await browser.close()
}
