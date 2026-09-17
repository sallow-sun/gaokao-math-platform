const { getTestPort, browserExecutable } = require('./browser-support.cjs')
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const path = require('node:path'),
  assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..')
const fixtures = require('./question-layout.fixture.json')
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
      '--strictPort',
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
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
    errors = [],
    queries = []
  page.on('pageerror', (e) => {
    errors.push(e.message)
    console.error('Browser error:', e.message)
  })
  const problems = [
    {
      ...fixtures[0],
      id: 'GC000001',
      type: 'single-choice',
      typeLabel: '单选题',
      content:
        '1. 已知集合 $A=\\{1,2,3\\}$，$B=\\{2,3,4\\}$，则 $A\\cap B=$（　）\nA. $\\{1\\}$    B. $\\{2,3\\}$    C. $\\{4\\}$    D. $\\{1,4\\}$',
    },
    ...fixtures,
    {
      ...fixtures[1],
      id: 'GS000099',
      content:
        '阅读下面的材料，回答问题。\n' +
        Array.from(
          { length: 75 },
          (_, i) => `（${i + 1}）已知函数 $f(x)=x^2+${i}$，求函数的最小值并写出证明过程。`,
        ).join('\n'),
    },
    {
      ...fixtures[1],
      id: 'GS000098',
      content: '计算图中三角形的面积。',
      assets: [{ url: '/uploads/paper-test.svg', altText: '三角形' }],
    },
  ]
  let fail = false,
    slow = false
  await page.route('**/uploads/**', (r) =>
    r.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="150"><path d="M20 130L130 15L240 130Z" fill="none" stroke="black"/><text x="124" y="12">A</text></svg>',
    }),
  )
  await page.route('**/api/**', async (r) => {
    const u = new URL(r.request().url())
    let body = {}
    if (u.pathname === '/api/v1/auth/me') body = { authenticated: false }
    else if (u.pathname === '/api/v1/curriculum') body = require('./curriculum.fixture.cjs')
    else if (u.pathname === '/api/v1/problems/tag-taxonomy')
      body = require('../../backend/src/main/resources/tag-taxonomy.json')
    else if (u.pathname === '/api/v1/problem-catalogs')
      body = { sources: [{ code: 'national-new-2', label: '新高考Ⅱ卷' }] }
    else if (u.pathname === '/api/v1/problems') {
      queries.push(u.searchParams)
      if (slow) await delay(500)
      if (fail) return r.fulfill({ status: 503, json: { error: { message: '测试网络错误' } } })
      body = {
        items: problems,
        pagination: {
          total: 30,
          page: Number(u.searchParams.get('page')),
          pageSize: 12,
          hasNext: true,
        },
      }
    }
    await r.fulfill({ json: body })
  })
  await page.goto(origin + '/paper', { waitUntil: 'networkidle' })
  assert.equal(
    await page.locator('.library-grid > :first-child').getAttribute('class'),
    'library-new',
  )
  await page.locator('.library-new').click()
  await page.getByLabel('试卷名称', { exact: true }).fill('第一份试卷')
  const firstUrl = page.url()
  await page.getByRole('link', { name: '← 我的试卷' }).click()
  await page.getByRole('button', { name: '打开试卷：第一份试卷', exact: true }).waitFor()
  await page.locator('.library-new').click()
  await page.getByLabel('试卷名称', { exact: true }).fill('第二份试卷')
  assert.notEqual(page.url(), firstUrl)
  await page.getByRole('link', { name: '← 我的试卷' }).click()
  assert.equal(await page.locator('.library-book').count(), 2)
  await page.getByRole('button', { name: '打开试卷：第一份试卷', exact: true }).click()
  assert.equal(await page.getByLabel('试卷名称', { exact: true }).inputValue(), '第一份试卷')
  await page.getByRole('link', { name: '← 我的试卷' }).click()
  await page.locator('.library-book').first().getByRole('button', { name: '移入回收站' }).click()
  assert.equal(await page.locator('.library-book').count(), 1)
  await page.getByRole('button', { name: '回收站', exact: true }).click()
  await page.getByRole('button', { name: '恢复试卷' }).click()
  await page.getByRole('button', { name: '返回书架' }).click()
  assert.equal(await page.locator('.library-book').count(), 2)
  await page.screenshot({ path: path.join(root, '.tmp/library-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({ path: path.join(root, '.tmp/library-mobile.png') })
  assert.deepEqual(errors, [])
  console.log('Paper library browser checks passed')
})()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server?.kill()
  })
