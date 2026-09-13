const { getTestPort, browserExecutable } = require('./browser-support.cjs')
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const path = require('node:path'),
  assert = require('node:assert/strict')
let browser, server
;(async () => {
  const port = await getTestPort(),
    origin = `http://127.0.0.1:${port}`,
    frontend = path.resolve(__dirname, '..')
  server = spawn(
    process.execPath,
    [
      path.join(frontend, 'node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: frontend, windowsHide: true, stdio: 'ignore' },
  )
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {}
    await delay(100)
  }
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage()
  let requests = 0,
    mode = 'error'
  await page.route('**/api/**', async (r) => {
    if (new URL(r.request().url()).pathname === '/api/v1/problems/random') {
      requests++
      await delay(300)
      return r.fulfill(
        mode === 'error'
          ? { status: 404, json: { error: { message: '题库暂时没有题目' } } }
          : { json: { problemId: 'GS000070' } },
      )
    }
    await r.fulfill({ json: { authenticated: false } })
  })
  await page.goto(origin, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '随机跳题', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: '正在选题…' }).isDisabled(), true)
  await page.getByText('题库暂时没有题目', { exact: true }).waitFor()
  assert.equal(new URL(page.url()).pathname, '/')
  mode = 'success'
  await page.getByRole('button', { name: '随机跳题', exact: true }).click()
  await page.waitForURL('**/problems/GS000070')
  assert.equal(requests, 2)
  console.log(
    'Home random: real endpoint, busy state, empty-bank error and retry navigation passed',
  )
})()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server?.kill()
  })
