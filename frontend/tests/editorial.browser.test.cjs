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
for (let n = 1; n <= 2; n++) fs.writeFileSync(path.join(fixture, `T${n}.md`), `---\nid:试卷T${n}\nnumber:T${n}\ndifficulty:D1\n---\ncontent:\n题干 $x=1$\nimg:0`)


;(async () => {
  const port = String(await require('./browser-support.cjs').getTestPort())
  const origin = `http://127.0.0.1:${port}`

  server = spawn(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', port, '--strictPort', '--force'], { cwd: path.join(root, 'frontend'), windowsHide: true, stdio: 'ignore' })
  for (let attempt=0; attempt<100; attempt++) {
    try { if ((await fetch(origin)).ok) break } catch {}
    await delay(100)
  }
  const chrome = process.env.CHROME_EXECUTABLE || (process.platform === 'win32' && fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined)
  browser = await chromium.launch({ executablePath: chrome, headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('console', message => { if (message.type()==='error') console.error('CONSOLE',message.text()) })
  page.on('requestfailed', request => console.error('REQUEST',request.url(), request.failure()))
  page.on('pageerror', (e) => errors.push(e.message))
  const id = '11111111-1111-4111-8111-111111111111'
  const paperId = '22222222-2222-4222-8222-222222222222'
  let item = { id, original_id: '2024全国甲卷T1', original_number: '1', paper_id: paperId, version: 1, status: 'DRAFT', history: [], availableAssets: [],
    document: { title: '2024全国甲卷T1', year: 2024, source: '全国甲卷', type: 'single-choice', level: 'red', tags: ['复数'], content: '设复数 $z=5+i$，求 $i(\\bar z+z)$。', answer: '', solution: '', assets: [], imageReferences: [], originalMetadata: { id: '2024全国甲卷T1' }, warnings: [] } }
  let saved = 0, action = ''
  let trashed = false, purged = false
  const publishedEntry = { id: 'GC000001', title: '已校对测试题' }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), pathname = url.pathname
    let body = {}, code = 200
    if (pathname.endsWith('/auth/me')) body = { authenticated: true, user: { id: 'user1', username: '测试管理员', role: 'ADMIN' } }
    else if (pathname === '/api/v1/curriculum') body = require('./curriculum.fixture.cjs')
    else if (pathname.endsWith('/auth/csrf')) body = { token: 'test', headerName: 'X-XSRF-TOKEN' }
    else if (pathname.endsWith('/editorial/me')) body = { id: 1, permission: 'MANAGER' }
    else if (pathname.endsWith('/editorial/papers')) body = [{ id: paperId, title: '2024全国甲卷' }]
    else if (pathname.endsWith('/editorial/items') && request.method() === 'GET') {
      const matching = url.searchParams.get('status') === 'CHANGES' ? item.status === 'CHANGES' : ['DRAFT','REVIEW'].includes(item.status)
      body = { items: matching ? [{ ...item, title: item.document.title, paper_title: '2024全国甲卷' }] : [], total: matching ? 1 : 0, page: 1, pageSize: 40 }
    }
    else if (pathname.endsWith(`/items/${id}/lease`)) body = request.method() === 'POST' ? item : {}
    else if (pathname.endsWith(`/items/${id}`)) {
      if (request.method() === 'PUT') { const update = request.postDataJSON(); assert.equal(update.version, item.version); item.document = update.document; item.version++; item.status = 'DRAFT'; saved++ }
      body = item
    }
    else if (pathname.endsWith(`/items/${id}/actions`)) { action = request.postDataJSON().action; item.version++; item.status = action === 'SUBMIT' ? 'REVIEW' : action === 'RETURN' ? 'CHANGES' : action === 'PUBLISH' ? 'PUBLISHED' : item.status; body = item }
    else if (pathname.endsWith('/admin/tags')) body = [{ name: '复数', active: true }, { name: '集合', active: true }]
    else if (pathname.endsWith('/admin/sources')) body = [{ code: 'national-a', label: '全国甲卷', active: true }]
    else if (pathname === '/api/v1/admin/problem-trash') {
      if (request.method() === 'POST') {
        assert.deepEqual(request.postDataJSON().numbers, ['GC000001'])
        trashed = true
      } else body = { items: trashed && !purged ? [publishedEntry] : [], total: trashed && !purged ? 1 : 0, page: 1 }
    }
    else if (pathname === '/api/v1/admin/problem-trash/GC000001/restore') trashed = false
    else if (pathname === '/api/v1/admin/problem-trash/GC000001' && request.method() === 'DELETE') {
      assert.equal(request.postDataJSON().number, 'GC000001')
      purged = true
    }
    else if (pathname.endsWith('/admin/problems')) body = { items: trashed ? [] : [publishedEntry], pagination: { total: trashed ? 0 : 1, page: 1, pageSize: 40 } }
    else if (pathname.endsWith('/admin/users')) body = { items: [], pagination: { total: 0, page: 1, pageSize: 40 } }
    else if (pathname.endsWith('/admin/stats')) body = { userTotal: 1, problemTotal: 2 }
    else if (pathname.endsWith('/editorial/batches') && request.method() === 'POST') body = { id: '33333333-3333-4333-8333-333333333333' }
    else if (pathname.endsWith('/editorial/import')) body = { result: 'IMPORTED', itemId: id, message: '已保存草稿' }
    else if (pathname.endsWith('/editorial/batches')) body = []
    await route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(origin + '/admin')
  await page.getByRole('heading', { name: '题目工作台', exact: true }).waitFor({timeout:10000}).catch(async (error) => { console.error('BROWSER_ERRORS',errors); console.error((await page.content()).slice(0,2500)); console.error((await page.locator('body').innerText()).slice(0,1500)); throw error })
  await page.getByRole('button', { name: '开始 / 继续审核', exact: true }).click()
  const approveBounds = await page.getByRole('button', { name: '通过并下一题', exact: true }).boundingBox()
  assert.ok(approveBounds.y + approveBounds.height <= 1000, 'review action remains in viewport')
  assert.equal(await page.locator('.curriculum-editor').count(),0,'initial review hides classification')
  assert.equal(await page.locator('.editorial-queue').count(),0,'directory starts collapsed')
  await page.getByRole('button', { name: /目录 ·/ }).click()
  assert.equal(await page.locator('.editorial-queue input[type="checkbox"]').count(),0,'review directory only opens individual questions')
  assert.equal(await page.getByRole('combobox',{name:'批量操作',exact:true}).count(),0)
  await page.locator('.editorial-queue-row button').first().click()
  await page.getByRole('button', { name: /目录 ·/ }).click()
  await page.screenshot({ path: path.join(output, 'review-reading.png'), fullPage: true })
  await page.getByRole('button', { name: '编辑题目', exact: true }).click()
  await page.getByRole('button', { name: '题目信息', exact: true }).click()
  await page.getByLabel('标题', { exact: true }).fill('已校对：全国甲卷第一题')
  await page.getByRole('button', { name: '正文', exact: true }).click()
  await page.getByLabel('编辑 题干', { exact: true }).fill('修改后 $x^2+1$')
  await page.getByRole('button', { name: '题目信息', exact: true }).click()
  await page.locator('.curriculum-editor summary').click()
  await page.locator('.curriculum-editor').getByLabel(/A11 /).check()
  await page.locator('.curriculum-editor').getByLabel(/A42 /).check()
  await page.getByLabel(/我已核对解法/).check()
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await page.getByText('草稿已保存，公开内容未改变').waitFor()
  await page.screenshot({ path: path.join(output, 'review-editing.png'), fullPage: true })
  assert.equal(saved, 1)
  assert.deepEqual(item.document.curriculum.chapters, ['A11','A42'])
  assert.equal(item.document.curriculum.confirmed, true)
  await page.getByRole('button', { name: '待修改并下一题', exact: true }).click()
  await page.getByRole('button', { name: '确认并下一题', exact: true }).click()
  await page.getByRole('button', { name: /目录 ·/ }).click()
  await page.getByRole('button', { name: '待修改', exact: true }).click()
  await page.locator('.editorial-queue-row button').first().click()
  await page.getByRole('button', { name: '修改完成并下一题', exact: true }).click()
  await page.getByRole('button', { name: '初审', exact: true }).click()
  await page.locator('.editorial-queue-row button').first().click()
  await page.getByRole('button', { name: '通过并下一题', exact: true }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: '通过并下一题', exact: true }).click()
  assert.equal(action, 'PUBLISH')
  await page.getByRole('button', { name: '已发布', exact: true }).click()
  assert.equal(await page.getByRole('button',{name:/删除所选/}).count(),0)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await page.getByText('已移入回收站，可恢复', { exact: true }).waitFor()
  assert.equal(trashed, true)
  await page.getByRole('button', { name: '更多', exact: true }).click()
  await page.getByRole('button', { name: '回收站', exact: true }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '恢复', exact: true }).click()
  await page.getByText('已恢复', { exact: true }).waitFor()
  assert.equal(trashed, false)
  await page.getByRole('button', { name: '已发布', exact: true }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await page.getByText('已移入回收站，可恢复', { exact: true }).waitFor()
  await page.getByRole('button', { name: '回收站', exact: true }).click()
  page.once('dialog', dialog => dialog.accept('wrong'))
  await page.getByRole('button', { name: '彻底删除', exact: true }).click()
  await page.getByText('题号不一致，未删除', { exact: true }).waitFor()
  assert.equal(purged, false)
  page.once('dialog', dialog => dialog.accept('GC000001'))
  await page.getByRole('button', { name: '彻底删除', exact: true }).click()
  await page.getByText('已彻底删除内容，题号不再使用', { exact: true }).waitFor()
  assert.equal(purged, true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(output, 'editorial-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: '批量导入', exact: true }).click()
  await page.locator('input[webkitdirectory]').setInputFiles(fixture)
  await page.getByText(/识别 2 道题/).waitFor()
  assert.equal(await page.locator('.editorial-import tbody tr').count(), 2)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(output, 'editorial-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: '初审', exact: true }).click()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)
  assert.equal(overflow, false, 'mobile should not overflow horizontally')
  assert.deepEqual(errors, [])
  console.log('PASS: edit, preview, save, submit, publish, directory selection, responsive layout, no browser errors')
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  await browser?.close()
  server?.kill()
  const tempRoot = path.resolve(require('node:os').tmpdir())
  if (path.resolve(fixture).startsWith(tempRoot + path.sep) && path.basename(fixture).startsWith('mathsea-browser-')) fs.rmSync(fixture, { recursive: true })
})
