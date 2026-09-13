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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const rules = require('../../backend/src/main/resources/growth-rules.json')
  let owner = true,
    max = false,
    failed = false,
    requests = 0,
    revoked = false
  function history() {
    return {
      summary: max
        ? { level: 6, experience: 3000, levelStart: 3000, remaining: 0, rules }
        : { level: 1, experience: 23, levelStart: 20, nextThreshold: 80, remaining: 57, rules },
      total: 2,
      page: 1,
      items: [
        {
          id: 1,
          kind: 'UPLOAD',
          points: 20,
          description: '投稿题目通过审核',
          created_at: '2026-09-13T10:00:00Z',
          rule_version: 'beta-1',
        },
        {
          id: 2,
          kind: 'STUDY',
          points: 2,
          description: '今日首次有效学习',
          created_at: '2026-09-13T09:00:00Z',
          rule_version: 'beta-1',
        },
      ],
    }
  }
  await page.route('**/api/**', async (r) => {
    const u = new URL(r.request().url())
    let data = {}
    if (u.pathname.endsWith('/auth/me'))
      data = { authenticated: true, user: { id: 1, username: 'Aurora', role: 'ADMIN' } }
    else if (u.pathname.endsWith('/auth/csrf')) data = { token: 'test', headerName: 'X-XSRF-TOKEN' }
    else if (u.pathname === '/api/v1/users/1')
      data = {
        id: 1,
        username: 'Aurora',
        uid: 'UID0000001',
        canEdit: owner,
        level: max ? 6 : 1,
        stats: {},
        dailyActivity: [],
        typeStats: [],
        tagStats: [],
      }
    else if (u.pathname.endsWith('/problem-statistics'))
      data = { levels: [], items: [], total: 0, page: 1, pageSize: 100 }
    else if (u.pathname === '/api/v1/users/me/growth') {
      requests++
      if (failed)
        return r.fulfill({ status: 503, json: { error: { message: '成长记录暂时不可用' } } })
      data = history()
    } else if (u.pathname === '/api/v1/admin/growth/users/1')
      data = { user: { id: 1, username: 'Aurora' }, history: history() }
    else if (u.pathname === '/api/v1/admin/growth/events/1/revoke') {
      assert.equal(r.request().postDataJSON().reason, '重复贡献')
      revoked = true
    }
    await r.fulfill({ json: data })
  })
  await page.goto(origin + '/user/1', { waitUntil: 'networkidle' })
  const panel = page.locator('.growth-panel')
  await panel.getByText('距 Lv.2 还差 57 经验', { exact: true }).waitFor()
  assert.equal(await page.locator('.account-level-badge').innerText(), 'Lv.1')
  await panel.getByRole('button', { name: '经验明细', exact: true }).click()
  await panel.getByText('投稿题目通过审核', { exact: true }).waitFor()
  await panel.locator('summary').click()
  await panel.screenshot({ path: path.join(root, '../.tmp/growth-desktop.png') })
  failed = true
  await panel.getByRole('button', { name: '刷新', exact: true }).click()
  await panel.getByText('成长记录暂时不可用', { exact: false }).waitFor()
  failed = false
  await panel.getByRole('button', { name: '重试', exact: true }).click()
  max = true
  await panel.getByRole('button', { name: '刷新', exact: true }).click()
  await panel.getByText('已达到当前最高等级', { exact: true }).waitFor()
  assert.equal(await panel.getByRole('progressbar').getAttribute('aria-valuenow'), '100')
  await panel.getByText('升级啦！现在是 Lv.6', { exact: true }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await panel.screenshot({ path: path.join(root, '../.tmp/growth-mobile.png') })
  owner = false
  await page.reload({ waitUntil: 'networkidle' })
  const before = requests
  assert.equal(await page.locator('.growth-panel').count(), 0)
  assert.equal(await page.locator('.account-level-badge').innerText(), 'Lv.6')
  await delay(200)
  assert.equal(requests, before)
  await page.route('**/growth-harness', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<html><body><div id="app"></div><script type="module">import {createApp} from '/node_modules/.vite/deps/vue.js';import Panel from '/src/components/admin/AdminGrowthPanel.vue';createApp(Panel).mount('#app')</script></body></html>`,
    }),
  )
  await page.goto(origin + '/growth-harness', { waitUntil: 'networkidle' })
  await page.locator('summary').click()
  await page.getByLabel('查询经验的用户ID').fill('1')
  await page.getByRole('button', { name: '查询经验', exact: true }).click()
  await page.getByRole('button', { name: '撤回此条', exact: true }).first().click()
  await page.getByLabel('撤回原因', { exact: true }).fill('重复贡献')
  await page.getByRole('button', { name: '确认撤回', exact: true }).click()
  await delay(200)
  assert.equal(revoked, true)
  assert.deepEqual(errors, [])
  console.log(
    'Growth UI: badge, progress, ledger, rules, max level, upgrade hint, failure retry, privacy, mobile and manager revocation passed',
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
