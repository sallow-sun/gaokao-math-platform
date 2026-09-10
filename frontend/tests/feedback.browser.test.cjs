require('./browser-support.cjs')
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..')
let browser, server
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
    ],
    { cwd: path.join(root, 'frontend'), windowsHide: true, stdio: 'ignore' },
  )
  for (let i = 0; i < 100; i++) {
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  let submitted = false,
    resolved = false,
    saved = false
  const report = {
    id: 1,
    version: 1,
    kind: '答案',
    description: '答案与解析结论不一致',
    suggestion: '请核对计算',
    status: 'OPEN',
    problem_snapshot: JSON.stringify({ content: '原题 $x=1$', answer: '1', solution: '原解析' }),
  }
  const item = {
    id: '11111111-1111-4111-8111-111111111111',
    version: 1,
    status: 'PUBLISHED',
    problem_number: 'GC000001',
    original_id: '反馈测试题',
    history: [],
    availableAssets: [],
    document: {
      title: '反馈测试题',
      year: 2024,
      source: '全国甲卷',
      type: 'single-choice',
      level: 'red',
      tags: ['集合与逻辑'],
      content: '原题 $x=1$',
      answer: '1',
      solution: '原解析',
      assets: [],
      imageReferences: [],
      warnings: [],
      originalMetadata: {},
      curriculum: { version: 'PEP-A-2019', chapters: [], confirmed: false },
    },
  }
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      u = new URL(req.url()),
      p = u.pathname
    let body = {}
    if (p.endsWith('/auth/me'))
      body = { authenticated: true, user: { id: '1', username: '管理员', role: 'ADMIN' } }
    else if (p.endsWith('/auth/csrf')) body = { token: 'test', headerName: 'X-XSRF-TOKEN' }
    else if (p === '/api/v1/feedback' && req.method() === 'POST') {
      assert.ok(req.postData().includes('答案与解析结论不一致'))
      submitted = true
      body = { id: 1 }
    } else if (p === '/api/v1/feedback/mine')
      body = {
        items: submitted ? [{ ...report, number: 'GC000001', title: '反馈测试题' }] : [],
        total: submitted ? 1 : 0,
      }
    else if (p === '/api/v1/admin/feedback')
      body = {
        items: resolved
          ? []
          : [{ number: 'GC000001', title: '反馈测试题', count: 1, deleted: false }],
        total: resolved ? 0 : 1,
      }
    else if (p === '/api/v1/admin/feedback/GC000001') body = [report]
    else if (p === '/api/v1/admin/feedback/resolve') {
      assert.deepEqual(req.postDataJSON().items, [{ id: 1, version: 1 }])
      assert.equal(req.postDataJSON().status, 'RESOLVED')
      resolved = true
      report.status = 'RESOLVED'
      report.response = '已核对并更新题目内容'
    } else if (p === '/api/v1/admin/feedback/publish') {
      assert.deepEqual(req.postDataJSON().feedback, [{ id: 1, version: 1 }])
      assert.equal(item.document.answer, '2')
      item.status = 'PUBLISHED'
      item.version++
      resolved = true
      report.status = 'RESOLVED'
      report.response = '已核对并更新题目内容'
      body = item
    } else if (p === '/api/v1/problems/GC000001') body = { ...item.document, id: 'GC000001' }
    else if (p.endsWith('/editorial/me')) body = { id: 1, permission: 'MANAGER' }
    else if (p.endsWith('/editorial/papers')) body = []
    else if (p.endsWith('/editorial/items') && req.method() === 'GET')
      body = { items: [], total: 0, page: 1 }
    else if (p.endsWith('/published/GC000001')) body = item
    else if (p.endsWith('/lease')) body = req.method() === 'POST' ? item : {}
    else if (p.endsWith(`/items/${item.id}`)) {
      if (req.method() === 'PUT') {
        item.document = req.postDataJSON().document
        item.version++
        item.status = 'DRAFT'
        saved = true
      }
      body = item
    } else if (p.endsWith('/actions')) {
      assert.equal(req.postDataJSON().action, 'PUBLISH')
      assert.equal(item.document.answer, '2')
      item.status = 'PUBLISHED'
      item.version++
      body = item
    } else if (p === '/api/v1/curriculum') body = require('./curriculum.fixture.cjs')
    else if (p.endsWith('/admin/tags')) body = [{ name: '集合与逻辑', active: true }]
    else if (p.endsWith('/admin/sources')) body = []
    else if (p.endsWith('/admin/problems') || p.endsWith('/admin/users'))
      body = { items: [], pagination: { total: 0, page: 1, pageSize: 40 } }
    else if (p.endsWith('/admin/stats')) body = { userTotal: 1, problemTotal: 1 }
    await route.fulfill({ json: body })
  })
  await page.goto(origin + '/feedback?number=GC000001')
  await page.getByLabel('问题类型', { exact: true }).selectOption('答案')
  await page.getByLabel('问题描述', { exact: true }).fill('答案与解析结论不一致')
  await page.getByRole('button', { name: '提交反馈', exact: true }).click()
  await page.getByText('反馈已提交，处理结果会显示在下方。').waitFor()
  assert.equal(submitted, true)
  await page.goto(origin + '/admin')
  await page.getByRole('button', { name: '用户反馈', exact: true }).click()
  await page.locator('.feedback-queue-item').first().click()
  await page.getByText('答案与解析结论不一致', { exact: true }).waitFor()
  await page.screenshot({ path: path.join(root, '.tmp/feedback-admin.png'), fullPage: true })
  await page.getByRole('button', { name: '修改题目并解决', exact: true }).click()
  await page.getByRole('button', { name: '答案', exact: true }).click()
  await page.getByLabel('编辑 答案', { exact: true }).fill('2')
  await page.getByRole('button', { name: '发布修改并解决反馈', exact: true }).click()
  await page.getByText('当前没有反馈', { exact: true }).waitFor()
  assert.equal(saved, true)
  assert.equal(resolved, true)
  await page.goto(origin + '/feedback')
  await page.getByText('已解决', { exact: true }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2))
  await page.screenshot({ path: path.join(root, '.tmp/feedback-mobile.png'), fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS: user feedback, grouped review, edit and resolve, user result, mobile')
})()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server?.kill()
  })
