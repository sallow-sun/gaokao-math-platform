const { getTestPort, browserExecutable } = require('./browser-support.cjs')
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const path = require('node:path'),
  assert = require('node:assert/strict')
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
  const page = await browser.newPage({ viewport: { width: 1480, height: 1000 } }),
    errors = [],
    requests = []
  page.on('pageerror', (e) => errors.push(e.message))
  const snapshot = {
    version: 1,
    title: '高三数学综合练习（一）',
    size: 'a4',
    targetScore: 150,
    items: [
      {
        problem: {
          id: 'GC000001',
          content: '已知集合 $A=\\{1,2,3\\}$，求 $A$ 的子集个数。',
          type: 'single-choice',
          typeLabel: '单选题',
          assets: [],
        },
        score: 5,
        space: 20,
        breakBefore: false,
      },
    ],
  }
  let paper = {
    id: '11111111-1111-4111-8111-111111111111',
    title: snapshot.title,
    kind: 'BUILDER',
    author: 'Aurora',
    source: '原创练习',
    year: 2026,
    exam_mode: '新高考Ⅰ卷',
    question_count: 1,
    total_score: 5,
    favorite_count: 0,
    rating_count: 0,
    canEdit: false,
    canCheck: true,
    favorite: false,
    myRating: [],
    snapshot,
    created_at: '2026-09-12T09:00:00Z',
    description: '集合与逻辑专题练习，适合一轮复习。',
  }
  let pdfAvailable = false
  await page.route('**/api/**', async (r) => {
    const u = new URL(r.request().url()),
      method = r.request().method()
    requests.push({ path: u.pathname, method })
    let body = {}
    if (u.pathname === '/api/v1/auth/me')
      body = { authenticated: true, user: { id: 2, username: 'Reader', role: 'ADMIN' } }
    else if (u.pathname === '/api/v1/auth/csrf')
      body = { headerName: 'X-XSRF-TOKEN', token: 'test' }
    else if (u.pathname === '/api/v1/papers')
      body = {
        items: [
          paper,
          ...Array.from({ length: 5 }, (_, i) => ({
            ...paper,
            id: `copy-${i}`,
            title: [
              '高考数学模拟卷 · 第二套',
              '解析几何专项练习',
              '高三数学阶段测试',
              '函数与导数提升训练',
              '概率统计专题',
            ][i],
            hot: i === 0,
          })),
        ],
        total: 6,
        page: 1,
        pdfAvailable,
      }
    else if (u.pathname === '/api/v1/papers/share') {
      const input = r.request().postDataJSON()
      assert.equal(input.snapshot.items[0].score, 5)
      paper = { ...paper, title: input.title, snapshot: { ...input.snapshot, title: input.title } }
      body = { id: paper.id }
    } else if (u.pathname.endsWith('/favorite')) {
      paper.favorite = r.request().postDataJSON().favorite
      paper.favorite_count = Number(paper.favorite)
    } else if (u.pathname.endsWith('/rating')) {
      paper.myRating = [r.request().postDataJSON()]
      paper.rating_count = 1
    } else if (u.pathname.endsWith('/check')) {
      paper.checked_at = '2026-09-12T09:00:00Z'
      paper.check_note = r.request().postDataJSON().note
      paper.checked_by_name = 'Reviewer'
    } else if (u.pathname.endsWith('/access')) body = { ok: true }
    else if (u.pathname === `/api/v1/papers/${paper.id}`) body = paper
    else if (u.pathname === '/api/v1/curriculum') body = require('./curriculum.fixture.cjs')
    else if (u.pathname === '/api/v1/problems/tag-taxonomy')
      body = require('../../backend/src/main/resources/tag-taxonomy.json')
    else if (u.pathname === '/api/v1/problems')
      body = { items: [], pagination: { total: 0, page: 1, pageSize: 12, hasNext: false } }
    await r.fulfill({ json: body })
  })
  await page.goto(origin + '/papers', { waitUntil: 'networkidle' })
  assert.equal(await page.locator('.shared-card').count(), 6)
  assert.equal(
    requests.some((r) => r.path.endsWith('/access')),
    false,
  )
  await page.screenshot({ path: path.join(root, '.tmp/shared-papers-desktop.png'), fullPage: true })
  await page.locator('.shared-card').first().click()
  await page.getByRole('button', { name: '收藏试卷 · 0' }).click()
  await page.getByRole('button', { name: '已收藏 · 1' }).waitFor()
  await page.getByRole('button', { name: '提交评价', exact: true }).click()
  await page.getByText('评价已保存', { exact: true }).waitFor()
  await page.getByLabel('已核对的内容').fill('已核对题干与配图')
  await page.getByRole('button', { name: '记录校核', exact: true }).click()
  await page.getByText('校核记录已保存', { exact: true }).waitFor()
  await page.screenshot({ path: path.join(root, '.tmp/shared-paper-detail.png'), fullPage: true })
  await page.evaluate((s) => {
    localStorage.setItem('mathsea:paper-draft:v1', JSON.stringify(s))
    localStorage.setItem(
      'mathsea:paper-library:v1',
      JSON.stringify([{ id: 'private', updatedAt: Date.now(), draft: s }]),
    )
  }, snapshot)
  const before = await page.evaluate(() => localStorage.getItem('mathsea:paper-draft:v1'))
  await page.getByRole('link', { name: '预览 / 打印', exact: true }).click()
  await page.locator('.paper-sheet').first().waitFor()
  assert.equal(await page.getByLabel('试卷名称', { exact: true }).getAttribute('readonly'), '')
  assert.equal(await page.getByRole('button', { name: '试卷设置', exact: true }).count(), 0)
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('.paper-bank').isVisible(), false)
  await page.waitForFunction(() =>
    document.querySelector('.paper-sheet')?.innerText.includes('子集'),
  )
  await page.evaluate(
    () =>
      (window.print = () => {
        window.__printed = !!document.querySelector('#paper-print-root .paper-sheet')
      }),
  )
  await page.getByRole('button', { name: '打印 / 存为 PDF', exact: true }).click()
  assert.equal(await page.evaluate(() => window.__printed), true)
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.getByRole('link', { name: '← 试卷详情', exact: true }).click()
  assert.equal(await page.evaluate(() => localStorage.getItem('mathsea:paper-draft:v1')), before)
  await page.getByRole('button', { name: '复制到我的组卷' }).click()
  await page.waitForURL('**/paper/edit/**')
  assert.equal(await page.getByLabel('试卷名称', { exact: true }).inputValue(), snapshot.title)
  await page.goto(origin + '/papers/new?draft=private', { waitUntil: 'networkidle' })
  await page.getByLabel('试卷名称', { exact: true }).fill('我的公开试卷')
  await page.getByRole('button', { name: '发布试卷', exact: true }).click()
  await page.waitForURL('**/papers/' + paper.id)
  assert.equal(paper.title, '我的公开试卷')
  await page.goto(origin + '/papers/new?kind=PDF', { waitUntil: 'networkidle' })
  await page.getByText('PDF 上传暂未开放，可先分享站内组卷。', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '发布试卷', exact: true }).isDisabled(), true)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(origin + '/papers', { waitUntil: 'networkidle' })
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  )
  await page.screenshot({ path: path.join(root, '.tmp/shared-papers-mobile.png'), fullPage: true })
  assert.deepEqual(errors, [])
  console.log(
    'Shared papers: list, publish, favorite, rating, review, readonly print, draft isolation, copy, OSS-disabled and mobile checks passed',
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
