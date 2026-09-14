// Entire API surface is mocked. This test cannot call a model or change real drafts.
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
  const page = await browser.newPage({ viewport: { width: 1350, height: 1100 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const id = 'a'.repeat(32),
    pid = 'b'.repeat(32)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLPsAAAAASUVORK5CYII=',
    'base64',
  )
  let job = {
    id,
    version: 1,
    filename: 'test.pdf',
    status: 'ready',
    error: '',
    calls: 0,
    usage: [],
    results: {},
    metadata: {
      title: '2026年测试卷数学',
      year: '2026',
      source: '本地测试',
      category: 'N',
      difficulty: '',
    },
    pages: [
      {
        id: pid,
        image: pid + '.png',
        width: 600,
        height: 700,
        edges: [0, 1000],
        columns: [
          {
            bands: [
              {
                id: 'c'.repeat(32),
                top: 0,
                bottom: 1000,
                question: '',
                type: '未知',
                section: 'content',
                skip: false,
              },
            ],
            suggestions: [],
          },
        ],
      },
    ],
  }
  let saves = 0,
    paid = 0,
    imports = 0,
    publish = 0,
    workerRequests = 0
  const md =
    '---\nid:2026年测试卷数学T1\ntitle:2026年测试卷数学T1\nyear:2026\nsource:本地测试\nsource_category:N\nquestion_type:填空题\nnumber:T1\ndifficulty:\ntags:\ncurriculum:PEP-A-2019\nchapters:\n---\ncontent:\n计算 $1+2=$____。\nanswer:\n\nsolution:\n\nimg:0\n'
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      method = request.method(),
      name = url.pathname
    let data = {}
    if (name.endsWith('/csrf')) data = { token: 'test', headerName: 'X-XSRF-TOKEN' }
    else if (name.includes('/document-import')) {
      workerRequests++
      if (name.endsWith('/health')) data = { ready: true, onlineConfigured: true }
      else if (name.endsWith('/jobs'))
        data = method === 'POST' ? job : [{ id, filename: job.filename, status: job.status }]
      else if (name.includes('/image/'))
        return route.fulfill({ contentType: 'image/png', body: png })
      else if (name.endsWith('/bundle'))
        data = Object.keys(job.results).map((number) => ({
          name: `2026年测试卷数学T${number}.md`,
          base64: Buffer.from(
            md
              .replaceAll('T1', `T${number}`)
              .replace('计算 $1+2=$____。', job.results[number].content),
          ).toString('base64'),
        }))
      else if (name.endsWith('/recognize')) {
        const body = request.postDataJSON()
        assert.equal(body.online, true)
        assert.equal(body.maxCalls, 1)
        assert.equal(body.batchSize, 3)
        assert.equal(body.version, job.version)
        paid++
        job = {
          ...job,
          version: job.version + 1,
          calls: 1,
          results: Object.fromEntries(
            ['1', '2', '3'].map((number) => [
              number,
              {
                type: '填空题',
                content: '计算 $1+2=$____。',
                answer: '',
                solution: '',
                assets: [],
              },
            ]),
          ),
        }
        data = job
      } else if (name.endsWith('/' + id)) {
        if (method === 'PUT') {
          const body = request.postDataJSON()
          assert.equal(body.version, job.version)
          for (const [n, edit] of Object.entries(body.edits))
            job.results[n] = { ...job.results[n], ...edit }
          job = { ...job, pages: body.pages, metadata: body.metadata, version: job.version + 1 }
          saves++
        }
        data = job
      } else throw new Error('Unexpected worker request ' + name)
    } else if (name.endsWith('/editorial/me')) data = { permission: 'MANAGER' }
    else if (name.endsWith('/editorial/items')) data = { items: [], total: 0, page: 1 }
    else if (name.endsWith('/editorial/papers')) data = method === 'POST' ? { id: 'paper' } : []
    else if (name.endsWith('/editorial/batches')) data = { id: 'batch' }
    else if (name.endsWith('/editorial/import')) {
      imports++
      assert.ok(request.postDataBuffer().includes(Buffer.from('question_type:填空题')))
      data = { result: 'IMPORTED', itemId: 'draft', message: '待审核草稿' }
    } else if (name.includes('/publish')) {
      publish++
      throw new Error('Publishing is forbidden')
    }
    await route.fulfill({ json: data })
  })
  await page.route('**/document-harness', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:16px;font-family:system-ui"><div id="app"></div><script type="module">import {createApp,h} from '/node_modules/.vite/deps/vue.js';import Panel from '/src/components/admin/EditorialWorkbench.vue';const app=createApp(Panel);app.component('RouterLink',{setup:(p,{slots})=>()=>h('a',{},slots.default())});app.mount('#app');</script></body></html>`,
    }),
  )
  await page.goto(origin, { waitUntil: 'networkidle' })
  errors.length = 0
  await page.goto(origin + '/document-harness', { waitUntil: 'networkidle' })
  assert.equal(workerRequests, 0, 'The original workbench must not contact the optional service')
  await page.getByRole('button', { name: '试卷切分', exact: true }).click()
  const panel = page.locator('.split-workbench')
  await panel
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf'),
    })
  await panel.getByText('已分组 0 题；1 个区域未分配。').waitFor()
  const svg = panel.locator('svg')
  async function clickAt(x, y) {
    await svg.scrollIntoViewIfNeeded()
    const box = await svg.boundingBox()
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y)
  }
  await panel.getByRole('button', { name: '添加竖线', exact: true }).click()
  await clickAt(0.5, 0.3)
  assert.equal(await panel.locator('.split-line.vertical').count(), 1)
  await panel.getByRole('button', { name: '添加横线', exact: true }).click()
  await clickAt(0.25, 0.4)
  assert.equal(await panel.locator('.split-line.horizontal').count(), 1)
  // Drag a boundary and verify that neighbouring regions stay adjacent after persistence.
  const line = panel.locator('.split-line.horizontal'),
    box = await line.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + 35)
  await page.mouse.up()
  await panel.getByRole('button', { name: '按先栏后行编号' }).click()
  await panel.getByRole('button', { name: '保存切分与内容' }).click()
  await panel.getByText('切分和内容已保存', { exact: true }).waitFor()
  assert.equal(saves, 1)
  assert.equal(job.pages[0].columns[0].bands[0].bottom, job.pages[0].columns[0].bands[1].top)
  assert.deepEqual(
    job.pages[0].columns.flatMap((c) => c.bands.map((b) => b.question)),
    ['1', '2', '3'],
  )
  await panel.getByRole('checkbox', { name: /我已确认分题边界/ }).check()
  await panel.getByRole('checkbox', { name: /允许将题块发送至百炼/ }).check()
  await panel.getByRole('button', { name: '开始识别', exact: true }).click()
  await panel.locator('.split-results').waitFor()
  assert.equal(paid, 1)
  const text = panel.locator('textarea').first()
  await text.fill('更正：计算 $1+2=$____。')
  await panel.getByRole('button', { name: '保存切分与内容' }).click()
  await panel.getByText('切分和内容已保存', { exact: true }).waitFor()
  assert.equal(job.results['1'].content, '更正：计算 $1+2=$____。')
  assert.ok((await panel.locator('.katex').count()) > 0)
  await panel.getByRole('button', { name: /送往批量导入/ }).click()
  const importPanel = page.locator('.editorial-import')
  await importPanel.getByRole('button', { name: '确认导入草稿' }).waitFor()
  assert.equal(imports, 0, 'Sending files must not silently import or publish them')
  await importPanel.getByLabel('归属正确').check()
  await importPanel.getByRole('button', { name: '确认导入草稿' }).click()
  await page.getByText('本批文件已处理，请查看逐题结果并开始复核。', { exact: true }).waitFor()
  assert.equal(imports, 3)
  assert.equal(publish, 0)
  await page.getByRole('button', { name: '试卷切分', exact: true }).click()
  assert.equal(
    await panel.locator('.split-line.vertical').count(),
    1,
    'Switching tabs preserves the task',
  )
  await page.screenshot({
    path: path.join(root, '../.tmp/document-split-desktop.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: path.join(root, '../.tmp/document-split-mobile.png'),
    fullPage: true,
  })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  assert.deepEqual(errors, [])
  console.log(
    'Document split: upload, Vue proxy split, drag, numbering, save, mock OCR, correction, math preview, draft-only import, tab persistence and mobile passed; 0 real API calls.',
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
