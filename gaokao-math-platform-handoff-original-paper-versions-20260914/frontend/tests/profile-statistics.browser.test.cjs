const { getTestPort, browserExecutable } = require('./browser-support.cjs')
const { chromium } = require('playwright'),
  { spawn } = require('node:child_process'),
  { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict'),
  path = require('node:path')
let server, browser
;(async () => {
  const port = await getTestPort(),
    origin = `http://127.0.0.1:${port}`,
    root = path.resolve(__dirname, '..')
  server = spawn(
    process.execPath,
    [
      path.join(root, 'node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: root, windowsHide: true, stdio: 'ignore' },
  )
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {}
    await delay(100)
  }
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const items = Array.from({ length: 112 }, (_, i) => ({
    id: 'GC' + String(i + 1).padStart(6, '0'),
    title: '数学练习 ' + (i + 1),
    level: i < 100 ? 'red' : 'blue',
  }))
  let fail = false
  await page.route('**/api/**', async (r) => {
    const u = new URL(r.request().url())
    let data = {}
    if (u.pathname.endsWith('/auth/me')) data = { authenticated: false }
    else if (u.pathname === '/api/v1/users/1')
      data = {
        id: 1,
        username: 'Aurora',
        uid: 'UID0000001',
        canEdit: false,
        stats: { completed: 112 },
        dailyActivity: [],
        typeStats: [],
        tagStats: [],
      }
    else if (u.pathname.endsWith('/problem-statistics')) {
      if (fail) return r.fulfill({ status: 503, json: { error: { message: '统计加载失败' } } })
      const list = items.filter(
        (x) =>
          (!u.searchParams.get('level') || u.searchParams.get('level') === x.level) &&
          (!u.searchParams.get('q') || x.id.includes(u.searchParams.get('q'))),
      )
      const p = Number(u.searchParams.get('page')) || 1
      data = {
        levels: [
          { level: 'red', count: 100 },
          { level: 'blue', count: 12 },
        ],
        total: list.length,
        page: p,
        pageSize: 100,
        items: list.slice((p - 1) * 100, p * 100),
      }
    }
    await r.fulfill({ json: data })
  })
  await page.goto(origin + '/user/1', { waitUntil: 'networkidle' })
  const panel = page.locator('.profile-problem-statistics')
  await panel.locator('.profile-number-links a').first().waitFor()
  assert.equal(await panel.locator('.profile-number-links a').count(), 100)
  await panel.getByRole('button', { name: '显示更多题号' }).click()
  await page.waitForFunction(
    () => document.querySelectorAll('.profile-number-links a').length === 112,
  )
  await panel.screenshot({ path: path.join(root, '../.tmp/profile-stats-desktop.png') })
  await panel.getByRole('button', { name: 'BLUE 12 题', exact: true }).click()
  await page.waitForFunction(
    () => document.querySelectorAll('.profile-number-links a').length === 12,
  )
  assert.equal(
    await panel.locator('.profile-number-links a').first().getAttribute('href'),
    '/problems/GC000101',
  )
  await panel.getByRole('button', { name: '全部已做 112 题', exact: true }).click()
  await panel.getByLabel('搜索已做题目').fill('GC000012')
  await panel.getByRole('button', { name: '搜索', exact: true }).click()
  await page.waitForFunction(
    () => document.querySelectorAll('.profile-number-links a').length === 1,
  )
  fail = true
  await panel.getByRole('button', { name: '搜索', exact: true }).click()
  await panel.getByText('统计加载失败', { exact: false }).waitFor()
  fail = false
  await panel.getByRole('button', { name: '重试' }).click()
  await page.waitForFunction(
    () => document.querySelectorAll('.profile-number-links a').length === 1,
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await panel.getByLabel('搜索已做题目').fill('')
  await panel.getByRole('button', { name: '搜索', exact: true }).click()
  await page.waitForFunction(
    () => document.querySelectorAll('.profile-number-links a').length === 100,
  )
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await panel.screenshot({ path: path.join(root, '../.tmp/profile-stats-mobile.png') })
  assert.deepEqual(errors, [])
  console.log(
    'Profile statistics: public grouped links, counts, pagination, filtering, search, retry and mobile passed',
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
