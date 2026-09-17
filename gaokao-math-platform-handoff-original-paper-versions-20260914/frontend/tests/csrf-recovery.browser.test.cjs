const { getTestPort, browserExecutable } = require('./browser-support.cjs')
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')

const root = path.resolve(__dirname, '../..')
let browser, server

;(async () => {
  const port = await getTestPort()
  const origin = `http://127.0.0.1:${port}`
  server = spawn(
    process.execPath,
    [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: path.join(root, 'frontend'), windowsHide: true, stdio: 'ignore' },
  )
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {}
    await delay(100)
  }

  const executablePath =
    browserExecutable ||
    (process.platform === 'win32' &&
    fs.existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
      ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
      : undefined)
  browser = await chromium.launch({ executablePath, headless: true })
  const page = await browser.newPage()
  let csrfCalls = 0
  let loginCalls = 0
  const loginTokens = []

  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/v1/auth/csrf') {
      csrfCalls += 1
      await route.fulfill({
        headers: { 'Cache-Control': 'no-store' },
        json: { headerName: 'X-XSRF-TOKEN', token: csrfCalls === 1 ? 'expired' : 'fresh' },
      })
      return
    }
    if (pathname === '/api/v1/auth/login') {
      loginCalls += 1
      loginTokens.push(route.request().headers()['x-xsrf-token'])
      if (loginCalls === 1) {
        await route.fulfill({ status: 403, body: '' })
        return
      }
      await route.fulfill({
        json: {
          authenticated: true,
          user: { id: 1, username: 'localadmin', role: 'ADMIN' },
        },
      })
      return
    }
    await route.fulfill({ json: [] })
  })
  await page.goto(`${origin}/login?redirect=/about`)
  await page.getByRole('textbox', { name: '登录账号' }).fill('localadmin')
  await page.locator('#login-password').fill('test-password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/about')

  assert.equal(csrfCalls, 2)
  assert.equal(loginCalls, 2)
  assert.deepEqual(loginTokens, ['expired', 'fresh'])
  console.log('PASS: an expired CSRF token is refreshed once before login is retried')
})()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server?.kill()
  })
