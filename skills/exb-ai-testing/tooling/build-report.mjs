#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const runDir = path.resolve(process.argv[2] || '')
if (!runDir || !fs.existsSync(runDir)) {
  console.error('Usage: node tooling/build-report.mjs <run-dir>')
  process.exit(1)
}

const analysisPath = path.join(runDir, 'analysis.md')
if (!fs.existsSync(analysisPath) || !fs.readFileSync(analysisPath, 'utf8').trim()) {
  console.error('[build-report] Missing or empty analysis.md; validation failed before report generation.')
  process.exit(2)
}

const reportDir = path.join(runDir, 'report')
fs.mkdirSync(reportDir, { recursive: true })

const screenshotFiles = []
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
    } else if (/\.(png|jpg|jpeg|webp)$/i.test(entry.name)) {
      screenshotFiles.push(path.relative(runDir, full))
    }
  }
}

walk(runDir)

const reportIndex = path.join(reportDir, 'index.html')
const reportHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI Testing Report</title>
    <style>
      body { font-family: sans-serif; margin: 32px; color: #1f2937; }
      h1 { margin-bottom: 8px; }
      .meta { color: #4b5563; margin-bottom: 24px; }
      .screenshots { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
      .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
      img { width: 100%; height: auto; border-radius: 6px; }
      pre { white-space: pre-wrap; background: #f9fafb; padding: 16px; border-radius: 8px; }
    </style>
  </head>
  <body>
    <h1>AI Testing Report</h1>
    <div class="meta">Run directory: ${runDir}</div>

    <h2>Analysis</h2>
    <pre>${fs.readFileSync(analysisPath, 'utf8').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>

    <h2>Screenshots</h2>
    <div class="screenshots">
      ${
        screenshotFiles.length
          ? screenshotFiles
              .map(
                (f) => `
                <div class="card">
                  <img src="../${f.replace(/\\/g, '/')}" alt="${f}" />
                  <div>${f}</div>
                </div>`
              )
              .join('')
          : '<div class="card">No screenshots were found for this run.</div>'
      }
    </div>
  </body>
</html>
`
fs.writeFileSync(reportIndex, reportHtml)

console.log(`[build-report] Validation passed for: ${runDir}`)
console.log(`[build-report] Generated report scaffolding at: ${reportDir}`)
console.log('[build-report] The final report should include the summary, evidence, screenshots, and next actions.')
