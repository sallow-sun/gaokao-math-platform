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
  const columns = await page
    .locator('.paper-filter-sidebar, .paper-bank, .paper-editor')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x))
  assert.ok(
    columns[0] < columns[1] && columns[1] < columns[2],
    'filters, bank and workspace must have separate columns',
  )
  assert.equal(await page.locator('.study-navigation').count(), 1)
  assert.equal(await page.locator('.paper-studio-nav').count(), 0)
  assert.equal(await page.locator('.study-navigation-link.is-active').innerText(), '组卷')
  assert.deepEqual(errors, [])
  assert.equal(await page.locator('.paper-canvas:visible .paper-sheet').count(), 1)
  assert.ok(await page.getByLabel('预览缩放').isVisible())
  const firstSplitter = page.getByRole('separator', { name: '调整筛选区和题库宽度' })
  const beforeFilter = await page.locator('.paper-filter-sidebar').boundingBox()
  const handle = await firstSplitter.boundingBox()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 80)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 45, handle.y + 80, { steps: 8 })
  await page.mouse.up()
  assert.ok(
    (await page.locator('.paper-filter-sidebar').boundingBox()).width > beforeFilter.width + 30,
  )
  const secondSplitter = page.getByRole('separator', { name: '调整题库和试卷宽度' })
  const beforeEditor = await page.locator('.paper-editor').boundingBox()
  await secondSplitter.focus()
  await page.keyboard.press('ArrowLeft')
  assert.ok((await page.locator('.paper-editor').boundingBox()).width > beforeEditor.width + 15)
  const savedColumns = await page.evaluate(() => localStorage.getItem('mathsea:paper-columns:v1'))
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(
    await page.evaluate(() => localStorage.getItem('mathsea:paper-columns:v1')),
    savedColumns,
  )
  await firstSplitter.dblclick()
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
  await page.getByTitle('从新页开始').click()
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
  await page
    .getByRole('group', { name: '学习进度', exact: true })
    .getByRole('button', { name: '自定义', exact: true })
    .click()
  const chapters = page.getByRole('region', { name: '自定义学习进度' })
  const chapterBox = await chapters.boundingBox()
  assert.ok(
    chapterBox.width >= 500 && chapterBox.x >= 0,
    'chapter selector must escape the narrow sidebar',
  )
  await chapters.getByRole('checkbox').first().check()
  await chapters.getByRole('button', { name: '应用筛选', exact: true }).click()
  await page.waitForTimeout(350)
  assert.equal(new URL(page.url()).pathname, '/paper')
  assert.equal(queries.at(-1).get('learning'), 'true')
  await page
    .getByRole('group', { name: '学习进度', exact: true })
    .getByRole('button', { name: '全部', exact: true })
    .click()
  await page.waitForTimeout(350)
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
      .locator('.paper-canvas .paper-fragment .paper-answer-space')
      .first()
      .evaluate((el) => parseFloat(el.style.height) === 40),
  )
  await page.getByRole('button', { name: '添加题目 GS000098', exact: true }).click()
  await ready()
  await page.getByRole('button', { name: '展开筛选', exact: true }).click()
  await page.locator('.paper-canvas [data-paper-id="GS000098"]').first().click()
  await page.getByLabel('移至题号', { exact: true }).selectOption('1')
  await ready()
  assert.equal(
    await page.locator('.paper-fragment').nth(1).getAttribute('data-paper-id'),
    'GS000098',
  )
  await page.getByRole('button', { name: '↶ 撤销', exact: true }).click()
  await ready()
  // A small pointer move must not start a drag or change order.
  const sourceBox = await page
    .locator('.paper-canvas [data-paper-id="GS000098"]')
    .first()
    .boundingBox()
  await page.mouse.move(sourceBox.x + 25, sourceBox.y + 20)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + 29, sourceBox.y + 20)
  assert.equal(await page.locator('.paper-drag-ghost').count(), 0)
  await page.mouse.up()
  await page
    .locator('.paper-canvas [data-paper-id="GS000098"] .paper-question-content')
    .first()
    .dragTo(page.locator('.paper-canvas [data-paper-id="GS000010"]').first(), {
      targetPosition: { x: 20, y: 2 },
    })
  await ready()
  assert.equal(
    await page.locator('.paper-fragment').nth(1).getAttribute('data-paper-id'),
    'GS000098',
  )
  await page.getByRole('button', { name: '↶ 撤销', exact: true }).click()
  await ready()
  await page.locator('.paper-fragment').first().click()
  await page.getByLabel('第 1 题分值', { exact: true }).fill('7.5')
  await page.getByLabel('第 1 题分值', { exact: true }).press('Tab')
  await ready()
  assert.ok(
    (await page.locator('.paper-canvas .paper-section-heading').first().textContent()).includes(
      '7.5 分',
    ),
  )
  await page.getByRole('button', { name: '试卷目录', exact: true }).first().click()
  await page.getByLabel('解答题批量分值').fill('9')
  await page.getByLabel('解答题批量分值').press('Tab')
  await ready()
  assert.ok((await page.locator('.paper-score-summary').textContent()).includes('25.5 分'))
  assert.equal(await page.locator('.paper-outline-item').count(), 3)
  await page.getByRole('button', { name: '筛选条件', exact: true }).click()
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await page.screenshot({ path: path.join(root, '.tmp/paper-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: '添加题目 GS000099', exact: true }).click()
  await ready()
  assert.ok(
    (await page.locator('.paper-canvas .paper-sheet').count()) >= 3,
    'long question must paginate',
  )
  assert.ok((await page.locator('.paper-canvas [data-paper-id="GS000099"]').count()) >= 2)
  const heights = await page
    .locator('.paper-canvas [data-paper-id="GS000099"]')
    .evaluateAll((els) =>
      els.map((el) => ({
        h: parseFloat(el.style.height),
        offset: el.querySelector('.paper-question-content').style.transform,
      })),
    )
  assert.ok(heights.every((v) => v.h > 1))
  const pageGeometry = await page
    .locator('.paper-fragment')
    .evaluateAll((els) => els.map((el) => el.style.height))
  await page.locator('.paper-canvas').evaluate((el) => {
    el.scrollTop = 0
  })
  const gripBox = await page.getByLabel('拖动第 4 题', { exact: true }).boundingBox()
  const canvasBox = await page.locator('.paper-canvas').boundingBox()
  await page.mouse.move(gripBox.x + 8, gripBox.y + 8)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height - 12, {
    steps: 6,
  })
  const initialScroll = await page.locator('.paper-canvas').evaluate((el) => el.scrollTop)
  await page.waitForTimeout(200)
  assert.equal(
    await page.locator('.paper-canvas').evaluate((el) => el.scrollTop),
    initialScroll,
    'edge scroll waits before starting',
  )
  await page.waitForTimeout(550)
  const laterScroll = await page.locator('.paper-canvas').evaluate((el) => el.scrollTop)
  assert.ok(
    laterScroll > initialScroll && laterScroll < initialScroll + 140,
    'edge scroll remains slow',
  )
  assert.deepEqual(
    await page.locator('.paper-fragment').evaluateAll((els) => els.map((el) => el.style.height)),
    pageGeometry,
    'drag keeps pagination fixed',
  )
  await page.keyboard.press('Escape')
  await page.mouse.up()
  assert.equal(await page.locator('.paper-drag-ghost').count(), 0)

  await page.evaluate(() => {
    window.print = () => {
      window.paperPrinted = true
    }
  })
  await page.getByRole('button', { name: '打印 / 存为 PDF', exact: true }).click()
  await page.waitForFunction(() => window.paperPrinted)
  assert.equal(
    await page.locator('#paper-print-root .paper-sheet').count(),
    await page.locator('.paper-canvas .paper-sheet').count(),
    'printing directly from the editable canvas includes every page',
  )
  assert.equal(await page.locator('#paper-print-root .paper-item-tools').count(), 0)
  assert.ok((await page.locator('#paper-print-root .paper-section-heading').count()) >= 2)
  assert.ok(
    (await page.locator('#paper-print-root .paper-instructions').textContent()).includes('满分'),
  )
  await page.evaluate(() => {
    window.dispatchEvent(new Event('afterprint'))
    window.paperPrinted = false
  })
  await page.getByRole('button', { name: '预览打印', exact: true }).click()
  await ready()
  assert.equal(await page.locator('.paper-item-tools:visible').count(), 0)
  assert.equal(await page.locator('.paper-filter-sidebar:visible').count(), 0)
  await page.evaluate(() => {
    window.print = () => {
      window.paperPrinted = true
    }
  })
  await page.getByRole('button', { name: '打印 / 存为 PDF', exact: true }).click()
  await page.waitForFunction(() => window.paperPrinted)
  assert.equal(await page.locator('#paper-print-root .paper-item-tools').count(), 0)
  assert.ok((await page.locator('#paper-print-root .paper-section-heading').count()) >= 2)
  assert.ok(
    (await page.locator('#paper-print-root .paper-instructions').textContent()).includes('满分'),
  )
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
  await page.getByLabel('搜索题目', { exact: true }).fill('集合')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await page.waitForTimeout(300)
  await page.getByLabel('搜索题目', { exact: true }).fill('函数')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await page.waitForTimeout(850)
  assert.equal(queries.at(-1).get('keyword'), '函数')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(250)
  assert.equal(await page.locator('.paper-filter-sidebar:visible').count(), 0)
  await page.getByRole('button', { name: '展开筛选', exact: true }).click()
  await page.getByRole('button', { name: '收起筛选', exact: true }).click()
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
