require('./browser-support.cjs')
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const root = path.resolve(__dirname, '../..')
const output = path.join(root, '.tmp')
fs.mkdirSync(output, { recursive: true })
let server, browser
const fixture = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mathsea-browser-'))
for (let n = 1; n <= 2; n++)
  fs.writeFileSync(
    path.join(fixture, `T${n}.md`),
    `---\nid:试卷T${n}\nnumber:T${n}\ndifficulty:D1\n---\ncontent:\n题干 $x=1$\nimg:0`,
  )

;(async () => {
  const port = String(await require('./browser-support.cjs').getTestPort())
  const origin = `http://127.0.0.1:${port}`

  server = spawn(
    process.execPath,
    [
      path.join(root, 'frontend/node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      port,
      '--strictPort',
      '--force',
    ],
    { cwd: path.join(root, 'frontend'), windowsHide: true, stdio: 'ignore' },
  )
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {}
    await delay(100)
  }
  const chrome =
    process.env.CHROME_EXECUTABLE ||
    (process.platform === 'win32' &&
    fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : undefined)
  browser = await chromium.launch({ executablePath: chrome, headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') console.error('CONSOLE', message.text())
  })
  page.on('requestfailed', (request) => console.error('REQUEST', request.url(), request.failure()))
  page.on('pageerror', (e) => errors.push(e.message))
  const id = '11111111-1111-4111-8111-111111111111'
  const paperId = '22222222-2222-4222-8222-222222222222'
  let item = {
    id,
    original_id: '2024全国甲卷T1',
    original_number: '1',
    paper_id: paperId,
    version: 1,
    status: 'DRAFT',
    history: [],
    availableAssets: [],
    document: {
      title: '2024全国甲卷T1',
      year: 2024,
      source: '全国甲卷',
      type: 'single-choice',
      level: 'red',
      tags: ['复数'],
      content: '设复数 $z=5+i$，求 $i(\\bar z+z)$。',
      answer: '',
      solution: '',
      assets: [],
      imageReferences: [],
      originalMetadata: { id: '2024全国甲卷T1' },
      warnings: [],
    },
  }
  const secondId = '44444444-4444-4444-8444-444444444444'
  const second = structuredClone(item)
  second.id = secondId
  second.document.content = '下一题内容 $x=2$'
  let slowLease = false
  let stuckLease = false,
    stuckPrefetch = false,
    nextLeases = 0
  let finishPublish,
    failPublish = true,
    publishRequests = 0
  let _saved = 0,
    action = ''
  let trashed = false,
    purged = false
  const publishedEntry = { id: 'GC000001', title: '已校对测试题' }
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      pathname = url.pathname
    let body = {},
      code = 200
    if (pathname.endsWith('/auth/me'))
      body = { authenticated: true, user: { id: 'user1', username: '测试管理员', role: 'ADMIN' } }
    else if (pathname === '/api/v1/curriculum') body = require('./curriculum.fixture.cjs')
    else if (pathname.endsWith('/auth/csrf')) body = { token: 'test', headerName: 'X-XSRF-TOKEN' }
    else if (pathname.endsWith('/editorial/me')) body = { id: 1, permission: 'MANAGER' }
    else if (pathname.endsWith('/editorial/papers')) body = [{ id: paperId, title: '2024全国甲卷' }]
    else if (pathname.endsWith('/editorial/items') && request.method() === 'GET') {
      const matching =
        url.searchParams.get('status') === 'CHANGES'
          ? item.status === 'CHANGES'
          : ['DRAFT', 'REVIEW'].includes(item.status)
      body = {
        items: matching
          ? [
              { ...item, title: item.document.title },
              { ...second, title: '下一题' },
            ]
          : [second],
        total: matching ? 2 : 1,
        page: 1,
        pageSize: 40,
      }
    } else if (pathname.endsWith(`/items/${secondId}/lease`)) {
      if (request.method() === 'POST') {
        nextLeases++
        if (stuckLease || (stuckPrefetch && nextLeases === 1)) return
      }
      if (slowLease && request.method() === 'POST') await delay(700)
      body = request.method() === 'POST' ? second : {}
    } else if (pathname.endsWith(`/items/${secondId}`)) {
      if (request.method() === 'PUT') {
        second.document = request.postDataJSON().document
        second.version++
      }
      body = second
    } else if (pathname.endsWith(`/items/${id}/lease`))
      body = request.method() === 'POST' ? item : {}
    else if (pathname.endsWith(`/items/${id}`)) {
      if (request.method() === 'PUT') {
        const update = request.postDataJSON()
        assert.equal(update.version, item.version)
        item.document = update.document
        item.version++
        item.status = 'DRAFT'
        _saved++
      }
      body = item
    } else if (pathname.endsWith(`/items/${id}/actions`)) {
      publishRequests++
      await new Promise((resolve) => {
        finishPublish = resolve
      })
      if (failPublish)
        return route.fulfill({ status: 503, json: { error: { message: '测试保存失败' } } })
      action = request.postDataJSON().action
      item.version++
      item.status =
        action === 'SUBMIT'
          ? 'REVIEW'
          : action === 'RETURN'
            ? 'CHANGES'
            : action === 'PUBLISH'
              ? 'PUBLISHED'
              : item.status
      body = item
    } else if (pathname.endsWith('/admin/tags'))
      body = [
        { name: '复数', active: true },
        { name: '集合', active: true },
      ]
    else if (pathname.endsWith('/admin/sources'))
      body = [{ code: 'national-a', label: '全国甲卷', active: true }]
    else if (pathname === '/api/v1/admin/problem-trash') {
      if (request.method() === 'POST') {
        assert.deepEqual(request.postDataJSON().numbers, ['GC000001'])
        trashed = true
      } else
        body = {
          items: trashed && !purged ? [publishedEntry] : [],
          total: trashed && !purged ? 1 : 0,
          page: 1,
        }
    } else if (pathname === '/api/v1/admin/problem-trash/GC000001/restore') trashed = false
    else if (pathname === '/api/v1/admin/problem-trash/purge' && request.method() === 'POST') {
      assert.equal(request.postDataJSON().items[0].id, 'GC000001')
      purged = true
    } else if (pathname.endsWith('/admin/problems'))
      body = {
        items: trashed ? [] : [publishedEntry],
        pagination: { total: trashed ? 0 : 1, page: 1, pageSize: 40 },
      }
    else if (pathname.endsWith('/admin/users'))
      body = { items: [], pagination: { total: 0, page: 1, pageSize: 40 } }
    else if (pathname.endsWith('/admin/stats')) body = { userTotal: 1, problemTotal: 2 }
    else if (pathname.endsWith('/editorial/batches') && request.method() === 'POST')
      body = { id: '33333333-3333-4333-8333-333333333333' }
    else if (pathname.endsWith('/editorial/import'))
      body = { result: 'IMPORTED', itemId: id, message: '已保存草稿' }
    else if (pathname.endsWith('/editorial/batches')) body = []
    await route.fulfill({
      status: code,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
  await page.goto(origin + '/admin')
  const preloaded = page.waitForResponse(
    (r) => r.url().endsWith(`/items/${secondId}/lease`) && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '开始 / 继续审核', exact: true }).click()
  await preloaded
  await page.waitForTimeout(100)
  const initialTop = await page
    .locator('.editorial-filters')
    .first()
    .evaluate((el) => el.getBoundingClientRect().top)
  await page.getByRole('button', { name: '通过并下一题', exact: true }).click()
  await page.getByText('下一题内容', { exact: false }).first().waitFor({ timeout: 2000 })
  for (let n = 0; n < 20 && !publishRequests; n++) await page.waitForTimeout(50)
  assert.equal(publishRequests, 1)
  assert.equal(
    await page.getByRole('button', { name: '通过并下一题', exact: true }).isDisabled(),
    true,
  )
  assert.equal(
    await page
      .locator('.editorial-filters')
      .first()
      .evaluate((el) => el.getBoundingClientRect().top),
    initialTop,
  )
  assert.equal(item.status, 'DRAFT', 'next question appears before publish finishes')
  finishPublish()
  await page.getByRole('button', { name: '返回失败题目重试' }).waitFor()
  assert.equal(
    await page
      .locator('.editorial-filters')
      .first()
      .evaluate((el) => el.getBoundingClientRect().top),
    initialTop,
  )
  await page.getByRole('button', { name: '返回失败题目重试' }).click()
  failPublish = false
  await page.getByRole('button', { name: '通过并下一题', exact: true }).click()
  await page.waitForTimeout(100)
  finishPublish()
  await page.getByText('上一题已保存', { exact: true }).waitFor()
  assert.equal(item.status, 'PUBLISHED')
  assert.equal(publishRequests, 2)
  item.status = 'DRAFT'
  await page.evaluate((id) => localStorage.setItem('mathsea:review-position:1:PENDING', id), id)
  await page.reload()
  const warmed = page.waitForResponse(
    (r) => r.url().endsWith(`/items/${secondId}/lease`) && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '开始 / 继续审核', exact: true }).click()
  await warmed
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: '通过并下一题', exact: true }).click()
  await page.getByRole('button', { name: '编辑题目', exact: true }).click()
  await page.getByLabel('编辑 题干', { exact: true }).fill('后台保存时编辑下一题')
  for (let n = 0; n < 20 && publishRequests < 3; n++) await page.waitForTimeout(50)
  finishPublish()
  await page.getByText('上一题已保存', { exact: true }).waitFor()
  assert.equal(
    await page.getByLabel('编辑 题干', { exact: true }).inputValue(),
    '后台保存时编辑下一题',
  )
  slowLease = true
  item.status = 'DRAFT'
  await page.evaluate((id) => localStorage.setItem('mathsea:review-position:1:PENDING', id), id)
  await page.reload()
  await page.getByRole('button', { name: '开始 / 继续审核', exact: true }).click()
  const requested = page.waitForRequest((r) => r.url().endsWith(`/items/${id}/actions`))
  await page.getByRole('button', { name: '通过并下一题', exact: true }).click()
  await requested
  await page.getByText('下一题内容', { exact: false }).first().waitFor({ timeout: 3000 })
  assert.equal(item.status, 'DRAFT', 'cold next-question loading must not wait for publication')
  finishPublish()
  await page.getByText('上一题已保存', { exact: true }).waitFor()
  slowLease = false
  stuckPrefetch = true
  nextLeases = 0
  item.status = 'DRAFT'
  await page.evaluate((id) => localStorage.setItem('mathsea:review-position:1:PENDING', id), id)
  await page.reload()
  await page.getByRole('button', { name: '开始 / 继续审核', exact: true }).click()
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: '通过并下一题', exact: true }).click()
  await page.getByText('下一题内容', { exact: false }).first().waitFor({ timeout: 2000 })
  for (let n = 0; n < 20 && publishRequests < 5; n++) await page.waitForTimeout(50)
  finishPublish()
  await page.getByText('上一题已保存', { exact: true }).waitFor()
  stuckPrefetch = false
  stuckLease = true
  item.status = 'DRAFT'
  await page.evaluate((id) => localStorage.setItem('mathsea:review-position:1:PENDING', id), id)
  await page.reload()
  await page.getByRole('button', { name: '开始 / 继续审核', exact: true }).click()
  await page.getByRole('button', { name: '通过并下一题', exact: true }).click()
  for (let n = 0; n < 20 && publishRequests < 6; n++) await page.waitForTimeout(50)
  finishPublish()
  await page.getByText(/下一题加载失败：/).waitFor({ timeout: 15000 })
  assert.equal(await page.locator('.editorial-switching').count(), 0)
  assert.equal(
    await page.getByRole('button', { name: '开始 / 继续审核', exact: true }).isEnabled(),
    true,
  )
  stuckLease = false
  await page.getByRole('button', { name: '开始 / 继续审核', exact: true }).click()
  await page.getByText('下一题内容', { exact: false }).first().waitFor()
  assert.deepEqual(errors, [])
  console.log('Background review: immediate next question, failure recovery and retry passed')
})()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server?.kill()
    fs.rmSync(fixture, { recursive: true, force: true })
  })
