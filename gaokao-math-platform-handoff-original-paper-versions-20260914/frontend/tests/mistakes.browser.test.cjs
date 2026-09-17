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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  let included = false,
    owner = true,
    fail = false
  const problem = require('./question-layout.fixture.json')[0]
  await page.route('**/api/**', async (r) => {
    const u = new URL(r.request().url())
    let data = {}
    if (u.pathname.endsWith('/auth/me'))
      data = { authenticated: true, user: { id: 1, username: 'Aurora', role: 'USER' } }
    else if (u.pathname.endsWith('/auth/csrf')) data = { token: 'test', headerName: 'X-XSRF-TOKEN' }
    else if (u.pathname === `/api/v1/problems/${problem.id}`) data = problem
    else if (u.pathname === `/api/v1/users/me/mistakes/${problem.id}`) {
      if (r.request().method() !== 'GET') {
        if (fail)
          return r.fulfill({ status: 503, json: { error: { message: '保存失败，请重试' } } })
        included = r.request().method() === 'PUT'
      }
      data = { included }
    } else if (u.pathname === '/api/v1/users/me/mistakes')
      data = {
        total: included ? 1 : 0,
        page: 1,
        items: included ? [{ problem, addedAt: '2026-09-13T00:00:00Z' }] : [],
      }
    else if (u.pathname === '/api/v1/users/1')
      data = {
        id: 1,
        username: 'Aurora',
        uid: 'UID0000001',
        canEdit: owner,
        stats: {},
        dailyActivity: [],
        typeStats: [],
        tagStats: [],
      }
    await r.fulfill({ json: data })
  })
  await page.goto(origin + '/problems/' + problem.id, { waitUntil: 'networkidle' })
  const add = page.getByRole('button', { name: '加入错题', exact: true })
  await add.waitFor()
  fail = true
  await add.click()
  await page.getByText('保存失败，请重试', { exact: true }).waitFor()
  assert.equal(included, false)
  fail = false
  await add.click()
  await page.getByRole('button', { name: '移出错题', exact: true }).waitFor()
  assert.equal(included, true)
  const styles = await page.locator('.question-info-actions').evaluate((el) => {
    const b = el.querySelector('button'),
      a = el.querySelector('a'),
      s = (e) => {
        const c = getComputedStyle(e)
        return [c.color, c.fontSize, c.fontWeight, c.lineHeight]
      }
    return { button: s(b), link: s(a) }
  })
  assert.deepEqual(styles.button, styles.link)
  assert.equal(
    await page.getByRole('link', { name: '题目反馈', exact: true }).getAttribute('href'),
    '/feedback?number=' + problem.id,
  )
  await page.screenshot({ path: path.join(root, '../.tmp/mistakes-question.png') })
  await page.goto(origin + '/user/1?tab=mistakes', { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: '重新练习 →', exact: true }).waitFor()
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('link', { name: '重新练习 →', exact: true }).waitFor()
  await page.screenshot({ path: path.join(root, '../.tmp/mistakes-profile.png') })
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: '移出错题', exact: true }).click()
  await page.getByText('还没有错题。打开题目，点击“加入错题”即可收录。', { exact: true }).waitFor()
  assert.equal(included, false)
  owner = false
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.getByRole('tab', { name: '我的错题', exact: true }).count(), 0)
  assert.equal(await page.locator('.mistakes-panel').count(), 0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(origin + '/problems/' + problem.id, { waitUntil: 'networkidle' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  assert.deepEqual(errors, [])
  console.log(
    'Mistakes: add/remove, failed save retry, persistence, profile privacy, feedback styling/link and mobile passed',
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
