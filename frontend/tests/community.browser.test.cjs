const { getTestPort, browserExecutable } = require('./browser-support.cjs')
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict'),
  path = require('node:path')
const root = path.resolve(__dirname, '../..')
let browser, server
;(async () => {
  const port = await getTestPort(),
    origin = `http://127.0.0.1:${port}`
  server = spawn(
    process.execPath,
    [
      path.join(root, 'frontend/node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    { cwd: path.join(root, 'frontend'), windowsHide: true, stdio: 'ignore' },
  )
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {}
    await delay(100)
  }
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  let visitor = false,
    submitted = false
  const entries = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'upload',
      title: '2025 年新高考Ⅰ卷 · 第 8 题',
      status: 'PENDING',
      created_at: '2026-09-12T00:00:00Z',
    },
    {
      id: '2',
      kind: 'feedback',
      title: '函数与导数',
      number: 'GC000002',
      status: 'RESOLVED',
      created_at: '2026-09-11T00:00:00Z',
    },
  ]
  await page.route('**/api/**', async (r) => {
    const u = new URL(r.request().url())
    let data = {}
    if (u.pathname.endsWith('/auth/me'))
      data = { authenticated: true, user: { id: 1, username: 'Aurora', role: 'USER' } }
    else if (u.pathname.endsWith('/auth/csrf')) data = { token: 'test', headerName: 'X-XSRF-TOKEN' }
    else if (u.pathname === '/api/v1/users/1')
      data = {
        id: 1,
        username: 'Aurora',
        uid: 'UID0000001',
        canEdit: !visitor,
        stats: { completed: 23, favorite: 2, contributed: 19, streak: 1 },
        dailyActivity: [],
        typeStats: [],
        tagStats: [],
      }
    else if (u.pathname === '/api/v1/users/1/contributions') {
      const kind = u.searchParams.get('kind'),
        status = u.searchParams.get('status')
      const items = entries.filter(
        (e) =>
          (!visitor || e.status === 'RESOLVED') &&
          (kind === 'all' || kind === e.kind) &&
          (status === 'all' || status === e.status),
      )
      data = {
        items,
        total: items.length,
        page: 1,
        summary: { accepted: 0, resolved: 1, pending: visitor ? 0 : 1 },
        owner: !visitor,
      }
    } else if (u.pathname.includes('/me/contributions/upload/'))
      data = {
        document: { content: '题干 $x^2$', answer: '2', solution: '推导' },
        response: '请补充来源',
      }
    else if (u.pathname === '/api/v1/users/me/contributions') {
      assert.equal(r.request().method(), 'POST')
      assert.equal(r.request().postDataJSON().title, '新投稿')
      submitted = true
      data = { id: 'new' }
    }
    await r.fulfill({ json: data })
  })
  await page.goto(origin + '/user/1')
  await page.getByRole('tab', { name: '社区贡献' }).click()
  await page.getByText('2025 年新高考Ⅰ卷 · 第 8 题', { exact: true }).waitFor()
  assert.equal(await page.getByText('学习概览', { exact: true }).count(), 0)
  await page.getByRole('button', { name: '处理详情' }).first().click()
  await page.getByText('处理说明：请补充来源').waitFor()
  await page.getByRole('button', { name: '关闭详情' }).click()
  await page.screenshot({ path: path.join(root, '.tmp/community-desktop.png') })
  await page.getByRole('button', { name: '纠错反馈', exact: true }).click()
  await page.locator('.community-entry').first().waitFor()
  assert.equal(await page.locator('.community-entry').count(), 1)
  await page.getByRole('link', { name: '＋ 上传题目' }).click()
  await page.getByLabel('题目名称', { exact: true }).fill('新投稿')
  await page.getByLabel('题干', { exact: true }).fill('求 $1+1$')
  await page.getByRole('button', { name: '提交审核' }).click()
  await page.getByRole('heading', { name: '题目已提交，等待审核' }).waitFor()
  assert.equal(submitted, true)
  await page.getByRole('link', { name: '← 返回社区贡献' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.community-entry').first().waitFor()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({ path: path.join(root, '.tmp/community-mobile.png') })
  visitor = true
  await page.reload()
  await page.locator('.community-entry').first().waitFor()
  assert.equal(await page.getByRole('link', { name: '＋ 上传题目' }).count(), 0)
  assert.equal(await page.getByRole('button', { name: '处理详情' }).count(), 0)
  assert.equal(await page.getByText('待处理贡献', { exact: true }).count(), 0)
  assert.deepEqual(errors, [])
  console.log(
    'Community profile: tabs, filters, own details, upload, visitor privacy and mobile passed',
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
