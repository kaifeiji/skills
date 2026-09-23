#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { loadPlaywright } from './load-playwright.mjs'

const args = process.argv.slice(2)
const appUrl = args[0]
const cacheIndex = args.indexOf('--cache-dir')
const cacheDir = path.resolve(cacheIndex === -1 ? path.join('.cache', 'browser-profile') : args[cacheIndex + 1])
const existingSessionTimeout = 30_000
const signInTimeout = 120_000
const pollInterval = 3_000

if (!appUrl) {
  console.error('Usage: node tooling/probe-session.mjs <app-url> [--cache-dir <dir>]')
  process.exit(1)
}

const signInUrl = new URL('/', appUrl).href
const { chromium } = loadPlaywright()
const hasBrowserProfile = fs.existsSync(cacheDir)
fs.mkdirSync(cacheDir, { recursive: true })

if (hasBrowserProfile) {
  console.log('[probe-session] Checking the app session.')
  const cachedState = await inspectWithBrowser(true, existingSessionTimeout)
  if (cachedState === 'signed-in') {
    console.log(`[probe-session] Existing session is valid: ${cacheDir}`)
    process.exit(0)
  }
}

await waitForSignIn()

async function inspectWithBrowser(headless, timeout = 60_000) {
  const deadline = Date.now() + timeout
  const context = await chromium.launchPersistentContext(cacheDir, { headless, ignoreHTTPSErrors: true })
  try {
    const page = await getSinglePage(context)
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: remainingTimeout(deadline) })
    return await readSessionState(page, remainingTimeout(deadline))
  } finally {
    await context.close()
  }
}

async function waitForSignIn() {
  const context = await chromium.launchPersistentContext(cacheDir, { headless: false, ignoreHTTPSErrors: true })
  try {
    const signInPage = await getSinglePage(context)
    await signInPage.goto(signInUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    if (await readSessionStateIfReady(signInPage) === 'signed-in') {
      console.log(`[probe-session] Shared browser session is ready: ${cacheDir}`)
      return
    }

    await signInPage.bringToFront()
    console.log('[probe-session] Complete sign-in in the open browser within 2 minutes.')

    const deadline = Date.now() + signInTimeout
    while (Date.now() < deadline) {
      await signInPage.waitForTimeout(Math.min(pollInterval, deadline - Date.now()))
      try {
        const state = await readSessionStateIfReady(signInPage)
        if (state === 'signed-in') {
          console.log(`[probe-session] Sign-in detected. Shared browser session is ready: ${cacheDir}`)
          return
        }
      } catch (error) {
        if (Date.now() >= deadline) break
      }
    }

    throw new Error('[probe-session] Sign-in was not detected within 2 minutes. Run the probe again to retry.')
  } finally {
    await context.close()
  }
}

async function getSinglePage(context) {
  const pages = context.pages()
  const page = pages[0] || await context.newPage()
  await Promise.all(pages.slice(1).map(async (extraPage) => extraPage.close()))
  return page
}

async function readSessionState(page, timeout = 60_000) {
  const deadline = Date.now() + timeout
  await page.waitForFunction(() => Boolean(window._sessionManager), null, { timeout: remainingTimeout(deadline) })
  await page.waitForFunction(
    () => Boolean(window._sessionManager?.getMainSession?.()),
    null,
    { timeout: remainingTimeout(deadline) },
  ).catch(() => {})
  return readSessionStateIfReady(page)
}

function remainingTimeout(deadline) {
  return Math.max(1, deadline - Date.now())
}

async function readSessionStateIfReady(page) {
  return page.evaluate(() => {
    const sessionManager = window._sessionManager
    if (!sessionManager) return 'unavailable'
    if (sessionManager.getMainSession()) return 'signed-in'
    return sessionManager.isMainSessionExpired() ? 'expired' : 'signed-out'
  }).catch(() => 'unavailable')
}