#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const appSlug = args[0]
const appUrl = args[1]
const output = args[2] || `config/${appSlug || 'app'}.json`

if (!appSlug || !appUrl) {
  console.error('Usage: node tooling/prepare-config-and-prompts.mjs <app-slug> <app-url> [output-file]')
  console.error('Example: node tooling/prepare-config-and-prompts.mjs explore-san-diego https://example.com/experience/demo config/explore-san-diego.json')
  process.exit(1)
}

const outDir = path.dirname(output)
fs.mkdirSync(outDir, { recursive: true })

const config = {
  slug: appSlug,
  url: appUrl,
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
console.log('[prepare-config-and-prompts] This step prepares both the app config and the prompt suite together.')
