const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { getTestPort, browserExecutable } = require('./browser-support.cjs')
let server, browser
;(async () => {
  const root = path.resolve(__dirname, '..'),
    port = await getTestPort(),
    origin = `http://127.0.0.1:${port}`
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
  const page = await browser.newPage({ viewport: { width: 1350, height: 1000 } }),
    errors = []
  page.on('pageerror', (e) => {
    errors.push(e.message)
    console.error(e.message)
  })
  let version = 1,
    assembly = {},
    published = false,
    conflict = false
  const problem = { problem_number: 'GC000001', content: '计算 $1+2$ 的值。', assets: [] }
  function detail() {
    return {
      id: 'one',
      title: '2026年新高考Ⅰ卷数学',
      assembly_version: version,
      assembly,
      token: `token-${version}`,
      items: [
        {
          id: 'item',
          original_number: '1',
          status: 'DRAFT',
          document: {
            title: '第一题',
            type: 'single-choice',
            content: '计算 $1+3$ 的值。',
            assets: [],
          },
          duplicates: [{ ...problem, title: '第一题' }],
          ...(assembly.items?.item?.reuse ? { problem } : {}),
        },
      ],
      versions: published
        ? [
            {
              id: 'published',
              revision: 1,
              revision_note: '题目、顺序和分值已核对',
              deleted: false,
            },
          ]
        : [],
    }
  }
  await page.route('**/api/**', async (r) => {
    const url = new URL(r.request().url()),
      method = r.request().method()
    let data = {}
    if (url.pathname.endsWith('/csrf')) data = { token: 'test', headerName: 'X-XSRF-TOKEN' }
    else if (url.pathname === '/api/v1/admin/original-papers')
      data = [
        {
          id: 'one',
          title: '2026年新高考Ⅰ卷数学',
          question_count: 1,
          revision: published ? 1 : null,
        },
      ]
    else if (url.pathname.endsWith('/publish')) {
      if (conflict)
        return r.fulfill({
          status: 409,
          json: { error: { message: '题目或原卷设置已更新，请重新加载并核对' } },
        })
      assert.equal(r.request().postDataJSON().version, version)
      assert.equal(assembly.items.item.reuse, 'GC000001')
      published = true
      version++
      data = { id: 'published' }
    } else if (url.pathname.endsWith('/one')) {
      if (method === 'PUT') {
        assembly = r.request().postDataJSON().assembly
        version++
      }
      data = detail()
    }
    await r.fulfill({ json: data })
  })
  await page.route('**/original-harness', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:24px;background:#eef2f5;font-family:system-ui"><div id="app"></div><script type="module">import {createApp,h} from '/node_modules/.vite/deps/vue.js';import Panel from '/src/components/admin/OriginalPaperWorkbench.vue';const app=createApp(Panel,{canPublish:true});app.component('RouterLink',{setup:(p,{slots})=>()=>h('a',{},slots.default())});app.mount('#app');</script></body></html>`,
    }),
  )
  await page.goto(origin, { waitUntil: 'networkidle' })
  errors.length = 0
  await page.goto(origin + '/original-harness', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /2026年新高考/ }).click()
  await page.getByLabel('原卷总分').fill('5')
  await page.getByText('发现 1 道疑似重复题，请比较公式、选项与配图').click()
  await page.getByRole('button', { name: '复用此题' }).click()
  await page.getByRole('button', { name: '保存整理草稿' }).click()
  await page.getByText('整理草稿已保存；可继续核对并发布。').waitFor()
  await page.getByText('查看保存时的最终题目 · GC000001').click()
  assert.ok(
    (await page.locator('.original-question .math-text').allTextContents()).some((text) =>
      text.includes('计算'),
    ),
  )
  await page.getByLabel('核验范围 / 版本说明').fill('题目、顺序和分值已核对')
  await page.getByRole('checkbox', { name: /我已对照原卷/ }).check()
  conflict = true
  await page.getByRole('button', { name: '核验并发布 v1' }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(published, false)
  conflict = false
  await page.getByRole('button', { name: '保存整理草稿' }).click()
  await page.getByText('整理草稿已保存；可继续核对并发布。').waitFor()
  await page.getByRole('checkbox', { name: /我已对照原卷/ }).check()
  await page.screenshot({ path: path.join(root, '../.tmp/original-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: '核验并发布 v1' }).click()
  await page.getByText('v1 · 查看 / 打印').waitFor()
  assert.equal(published, true)
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: path.join(root, '../.tmp/original-mobile.png'), fullPage: true })
  assert.deepEqual(errors, [])
  console.log(
    'Original papers: grouping, duplicate reuse, totals, saved review, stale conflict, publish and mobile passed',
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
