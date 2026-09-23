import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

export function loadPlaywright() {
  const localRequire = createRequire(path.join(process.cwd(), 'package.json'))
  try {
    return localRequire('@playwright/test')
  } catch {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    try {
      const globalRoot = process.platform === 'win32'
        ? execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm root -g'], { encoding: 'utf8' }).trim()
        : execFileSync(npm, ['root', '-g'], { encoding: 'utf8' }).trim()
      return createRequire(path.join(globalRoot, 'package.json'))('@playwright/test')
    } catch (error) {
      throw new Error(
        'Playwright is unavailable. Install @playwright/test in this project or globally with "npm install -g @playwright/test".',
        { cause: error },
      )
    }
  }
}