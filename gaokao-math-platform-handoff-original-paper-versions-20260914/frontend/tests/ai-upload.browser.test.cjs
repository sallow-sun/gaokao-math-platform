const { getTestPort, browserExecutable } = require('./browser-support.cjs')
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')

const root = path.resolve(__dirname, '../..')
let browser, server

;(async () => {
  const port = await getTestPort()
  const origin = `http://127.0.0.1:${port}`
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
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {}
    await delay(100)
  }

  const executablePath =
    browserExecutable ||
    (process.platform === 'win32' &&
    fs.existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
      ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
      : undefined)
  browser = await chromium.launch({ executablePath, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errors = []
  let submitted = null
  let modelCalls = 0
  let adminMode = false
  const itemId = '11111111-1111-4111-8111-111111111111'
  const paperId = '22222222-2222-4222-8222-222222222222'
  const editorialItem = {
    id: itemId,
    original_id: 'AI测试题',
    original_number: '1',
    paper_id: paperId,
    version: 1,
    status: 'DRAFT',
    history: [],
    availableAssets: [],
    document: {
      title: '待分类题目',
      year: 2026,
      source: '测试卷',
      type: 'single-choice',
      level: 'yellow',
      tags: [],
      content: '已知函数$f(x)=x^2$,求其单调区间。',
      answer: '',
      solution: '',
      assets: [],
      imageReferences: [],
      originalMetadata: {},
      warnings: [],
      curriculum: { chapters: [], confirmed: false },
    },
  }
  page.on('pageerror', (error) => errors.push(error.message))

  await page.route('**/__mathsea_similarity_proxy', async (route) => {
    modelCalls++
    const request = route.request().postDataJSON()
    assert.equal(
      request.taskType,
      adminMode ? 'official-upload-analysis' : 'community-upload-analysis',
    )
    assert.equal(request.jsonMode, true)
    assert.match(request.messages[0].content, /不得补做题目/)
    await route.fulfill({
      json: {
        model: request.model,
        elapsedMs: 42,
        usage: { totalTokens: 321 },
        content: JSON.stringify({
          cleaned_title: '导数综合题',
          cleaned_content: '已知函数 $f(x)=x^2$，求其单调区间。',
          cleaned_answer: '',
          cleaned_solution: '',
          type: adminMode ? 'fill-blank' : 'solution',
          level: 'green',
          tags: ['函数与导数', '模型自造标签'],
          confidence: { format: 0.95, type: 0.92, level: 0.76, tags: 0.9 },
          reasons: {
            type: '需要写出推导过程',
            level: '包含导数与单调性判断',
            tags: '核心知识点是导数应用',
          },
          unmapped_tags: ['极值点偏移'],
          warnings: [],
        }),
      },
    })
  })

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    let body = {}
    if (pathname.endsWith('/auth/me'))
      body = {
        authenticated: true,
        user: {
          id: 1,
          username: adminMode ? '测试管理员' : '测试用户',
          role: adminMode ? 'ADMIN' : 'USER',
        },
      }
    else if (pathname.endsWith('/auth/csrf')) body = { token: 'test', headerName: 'X-XSRF-TOKEN' }
    else if (pathname.endsWith('/problems/tag-taxonomy'))
      body = [
        {
          name: '函数与导数',
          aliases: ['函数', '导数'],
          chapters: ['A13', 'A42'],
          children: [],
        },
      ]
    else if (pathname.endsWith('/editorial/me')) body = { id: 1, permission: 'MANAGER' }
    else if (pathname.endsWith('/editorial/papers'))
      body = [{ id: paperId, title: '测试卷', pending_count: 1, changes_count: 0 }]
    else if (pathname.endsWith('/editorial/items') && request.method() === 'GET')
      body = {
        items: [{ ...editorialItem, title: editorialItem.document.title, paper_title: '测试卷' }],
        total: 1,
        page: 1,
        pageSize: 40,
      }
    else if (pathname.endsWith(`/editorial/items/${itemId}/lease`))
      body = request.method() === 'POST' ? editorialItem : {}
    else if (pathname.endsWith('/admin/tags'))
      body = [{ name: '函数与导数', active: true }]
    else if (pathname.endsWith('/admin/sources'))
      body = [{ code: 'test', label: '测试卷', active: true }]
    else if (pathname.endsWith('/admin/stats')) body = { userTotal: 1, problemTotal: 1 }
    else if (pathname.endsWith('/admin/users'))
      body = { items: [], pagination: { total: 0, page: 1, pageSize: 40 } }
    else if (pathname === '/api/v1/curriculum')
      body = require('./curriculum.fixture.cjs')
    else if (pathname.endsWith('/users/me/contributions')) {
      submitted = request.postDataJSON()
      body = { id: 'new-item' }
    }
    await route.fulfill({ json: body })
  })

  await page.goto(`${origin}/contribute`)
  await page.getByRole('heading', { name: '上传题目', exact: true }).waitFor()
  assert.equal(await page.getByText('逐项选择后再应用').count(), 0)
  await page.getByLabel('题目名称', { exact: true }).fill('原始题名')
  await page
    .getByLabel('题干', { exact: true })
    .fill('已知函数$f(x)=x^2$,求其单调区间。')

  await page.getByRole('button', { name: '打开 AI 辅助上传' }).click()
  await page.getByText('规则 1.4 即时检查', { exact: true }).waitFor()
  assert.equal(await page.getByText(/在浏览器本地运行/).count(), 1)
  await page.getByRole('button', { name: 'Qwen 百炼', exact: true }).click()
  await page.getByLabel('API Key', { exact: true }).fill('test-key')
  await page.getByRole('button', { name: '开始分析', exact: true }).click()
  await page.getByText('逐项选择后再应用').waitFor()

  assert.equal(
    await page.getByLabel('题干', { exact: true }).inputValue(),
    '已知函数$f(x)=x^2$,求其单调区间。',
    '分析结果不能自动覆盖表单',
  )
  assert.equal(await page.getByText(/已拦截非标准标签/).count(), 1)
  assert.equal(await page.getByText('极值点偏移', { exact: true }).count(), 1)

  await page.getByRole('button', { name: '通过规则校验并应用', exact: true }).click()
  assert.equal(await page.locator('.community-upload-grid select').inputValue(), 'solution')
  assert.equal(
    await page.getByLabel('题干', { exact: true }).inputValue(),
    '已知函数 $f(x)=x^2$，求其单调区间。',
  )
  await page.getByText('D4 · 中等', { exact: true }).last().waitFor()
  await page.getByRole('button', { name: '提交审核', exact: true }).click()
  await page.getByRole('heading', { name: '题目已提交，等待审核' }).waitFor()

  assert.equal(modelCalls, 1)
  assert.equal(submitted.level, 'green')
  assert.deepEqual(submitted.tags, ['函数与导数'])
  assert.equal(submitted.type, 'solution')

  adminMode = true
  await page.goto(`${origin}/admin`)
  await page.getByRole('heading', { name: '题目工作台', exact: true }).waitFor()
  await page.getByRole('button', { name: '开始 / 继续审核', exact: true }).click()
  await page.getByRole('button', { name: '编辑题目', exact: true }).click()
  await page.getByRole('button', { name: '打开官方 AI 辅助上传' }).click()
  await page.locator('.ai-upload').getByRole('button', { name: 'Qwen 百炼', exact: true }).click()
  await page.locator('.ai-upload').getByLabel('API Key', { exact: true }).fill('test-key')
  await page.getByRole('button', { name: '开始分析', exact: true }).click()
  await page.getByText('逐项选择后再应用').waitFor()
  assert.equal(
    await page.locator('.editorial-form select:has(option[value="fill-blank"])').inputValue(),
    'single-choice',
    '官方分析也不能自动覆盖分类',
  )
  await page.getByRole('button', { name: '通过规则校验并应用', exact: true }).click()
  assert.equal(
    await page.locator('.editorial-form select:has(option[value="fill-blank"])').inputValue(),
    'fill-blank',
  )
  assert.equal(await page.locator('.editorial-tag-list input:checked').count(), 1)
  assert.equal(modelCalls, 2)
  assert.deepEqual(errors, [])
  console.log('PASS: community and official AI upload require confirmation and enforce catalogs')
})()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server?.kill()
  })
