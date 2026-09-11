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
  await page.screenshot({ path: path.join(root, '.tmp/paper-initial.png') })
  assert.deepEqual(errors, [])
  const added = () => page.locator('.paper-source-card.is-added')
  const ready = () =>
    page.waitForFunction(
      () => !document.querySelector('.paper-status')?.textContent.includes('正在排版'),
    )
  await page.locator('[data-source-id="GC000001"] .math-text').dragTo(page.locator('.paper-empty'))
  assert.equal(await page.evaluate(() => window.getSelection().toString()), '')
  await ready()
  assert.equal(await added().count(), 1)
  await page.getByRole('button', { name: '添加题目 GS000010', exact: true }).click()
  await ready()
  assert.equal(await added().count(), 2)
  assert.equal(
    await page.locator('.paper-canvas .paper-choice .katex').count(),
    4,
    'all four option formulas must be preserved',
  )
  await page.locator('.paper-fragment').nth(1).click()
  await page
    .locator('.paper-fragment')
    .nth(1)
    .locator('.paper-question-content')
    .dragTo(page.locator('.paper-fragment').first(), { targetPosition: { x: 10, y: 2 } })
  await ready()
  assert.equal(
    await page.locator('.paper-fragment').first().getAttribute('data-paper-id'),
    'GS000010',
  )
  await page.getByRole('button', { name: '↶ 撤销', exact: true }).click()
  await ready()
  await page.locator('.paper-fragment').nth(1).click()
  await page.locator('.paper-fragment').nth(1).getByTitle('从新页开始').click()
  await ready()
  assert.equal(await page.locator('.paper-canvas .paper-sheet').count(), 2)
  await page.getByRole('button', { name: '↶ 撤销', exact: true }).click()
  await ready()
  await page.locator('.paper-added').first().click()
  assert.equal(await added().count(), 2)
  await page.getByRole('button', { name: '函数与导数', exact: true }).click()
  await page.waitForTimeout(350)
  assert.ok(queries.at(-1).getAll('tag').includes('函数与导数'))
  assert.equal(await added().count(), 2)
  assert.equal(new URL(page.url()).pathname, '/paper')
  await page
    .getByRole('group', { name: '来源', exact: true })
    .getByRole('button', { name: '更多', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: '所有来源' })
    .getByRole('button', { name: '新高考Ⅱ卷', exact: true })
    .click()
  await page.waitForTimeout(350)
  assert.equal(queries.at(-1).get('source'), 'national-new-2')
  await page.getByRole('button', { name: '收起筛选', exact: true }).click()
  await page.getByLabel('题目排序').selectOption('random')
  await page.waitForTimeout(350)
  const seed = queries.at(-1).get('seed')
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await page.waitForTimeout(150)
  assert.equal(queries.at(-1).get('seed'), seed)
  assert.equal(queries.at(-1).get('page'), '2')
  await page.getByRole('button', { name: /换一批/ }).click()
  await page.waitForTimeout(350)
  assert.notEqual(queries.at(-1).get('seed'), seed)
  assert.equal(queries.at(-1).get('page'), '1')
  await page.locator('.paper-fragment').first().click()
  await page.getByLabel('第 1 题答题留白').selectOption('40')
  await ready()
  assert.ok(
    await page
      .locator('.paper-fragment .paper-answer-space')
      .first()
      .evaluate((el) => el.getBoundingClientRect().height > 80),
  )
  await page.locator('.paper-fragment').nth(1).click()
  await page.locator('.paper-fragment').nth(1).getByTitle('上移', { exact: true }).click()
  await ready()
  assert.equal(
    await page.locator('.paper-fragment').first().getAttribute('data-paper-id'),
    'GS000010',
  )
  await page.getByRole('button', { name: '↶ 撤销', exact: true }).click()
  await ready()
  assert.equal(
    await page.locator('.paper-fragment').first().getAttribute('data-paper-id'),
    'GC000001',
  )
  await page.getByRole('button', { name: '添加题目 GS000098', exact: true }).click()
  await ready()
  await page.screenshot({ path: path.join(root, '.tmp/paper-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: '添加题目 GS000099', exact: true }).click()
  await ready()
  assert.ok(
    (await page.locator('.paper-canvas .paper-sheet').count()) >= 3,
    'long question must paginate',
  )
  assert.ok((await page.locator('[data-paper-id="GS000099"]').count()) >= 2)
  const heights = await page.locator('[data-paper-id="GS000099"]').evaluateAll((els) =>
    els.map((el) => ({
      h: parseFloat(el.style.height),
      offset: el.querySelector('.paper-question-content').style.transform,
    })),
  )
  assert.ok(heights.every((v) => v.h > 1))
  await page.getByRole('button', { name: '预览打印', exact: true }).click()
  await ready()
  assert.equal(await page.locator('.paper-item-tools:visible').count(), 0)
  await page.evaluate(() => {
    window.print = () => {
      window.paperPrinted = true
    }
  })
  await page.getByRole('button', { name: '打印 / 存为 PDF', exact: true }).click()
  await page.waitForFunction(() => window.paperPrinted)
  assert.equal(await page.locator('#paper-print-root .paper-item-tools').count(), 0)
  assert.equal(
    await page.locator('#paper-print-root .paper-sheet').count(),
    await page.locator('.paper-canvas .paper-sheet').count(),
  )
  await page.pdf({
    path: path.join(root, '.tmp/paper-preview.pdf'),
    preferCSSPageSize: true,
    printBackground: true,
  })
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.getByLabel('纸张尺寸').selectOption('16k')
  await ready()
  await page.screenshot({ path: path.join(root, '.tmp/paper-preview.png'), fullPage: true })
  await page.reload({ waitUntil: 'networkidle' })
  await ready()
  assert.equal(await added().count(), 4)
  await page.locator('.paper-fragment').first().click()
  await page.getByLabel('移除第 1 题', { exact: true }).click()
  await ready()
  assert.equal(await added().count(), 3)
  await page.getByRole('button', { name: '清空试卷', exact: true }).click()
  await ready()
  assert.equal(await added().count(), 0)
  await page.getByRole('button', { name: '↶ 撤销', exact: true }).click()
  await ready()
  assert.equal(await added().count(), 3)
  fail = true
  await page.getByRole('button', { name: /换一批/ }).click()
  await page.getByRole('alert').filter({ hasText: '测试网络错误' }).waitFor()
  assert.equal(await page.locator('.paper-source-card').count(), 0)
  fail = false
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await page.waitForTimeout(200)
  slow = true
  await page.getByLabel('关键词', { exact: true }).fill('集合')
  await page.getByRole('button', { name: '查找题目', exact: true }).click()
  await page.waitForTimeout(300)
  await page.getByLabel('关键词', { exact: true }).fill('函数')
  await page.getByRole('button', { name: '查找题目', exact: true }).click()
  await page.waitForTimeout(850)
  assert.equal(queries.at(-1).get('keyword'), '函数')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(250)
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'mobile must not overflow horizontally',
  )
  await page.screenshot({ path: path.join(root, '.tmp/paper-mobile.png'), fullPage: true })
  assert.deepEqual(errors, [])
  console.log(
    'Paper builder: drag, filters, stable shuffle, reorder, undo, draft, pagination, PDF, errors and mobile passed',
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
