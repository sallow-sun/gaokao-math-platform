const { browserExecutable, getTestPort } = require('../../../tests/browser-support.cjs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')

let browser
let server

;(async () => {
  const port = await getTestPort()
  const origin = `http://127.0.0.1:${port}`
  const frontend = path.resolve(__dirname, '../../..')
  const relayRequests = []
  server = spawn(
    process.execPath,
    [
      path.join(frontend, 'node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: frontend, windowsHide: true, stdio: 'ignore' },
  )

  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {
      // Vite may still be starting; retry until the bounded loop ends.
    }
    await delay(100)
  }

  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/api/v1/problems/P10002', (route) =>
    route.fulfill({
      json: {
        id: 'P10002',
        title: '2024 年全国甲卷 · T21',
        type: 'solution',
        typeLabel: '解答题',
        content: '已知函数 f(x)=x³−3x²+a，求单调区间并讨论极值。',
        tags: ['函数', '导数'],
        answer: '按导数符号分类。',
        solution: '先求导，再由临界点判断单调性。',
      },
    }),
  )
  await page.route('**/api/**', (route) => {
    if (route.request().url().includes('/api/v1/problems/P10002')) return route.fallback()
    return route.fulfill({ json: { authenticated: false } })
  })
  await page.route('**/__mathsea_similarity_proxy', async (route) => {
    const request = route.request().postDataJSON()
    relayRequests.push(request)
    await route.fulfill({
      json: {
        content: request.taskType === 'connection-test' ? 'OK' : '先求导，观察导函数零点与符号变化。',
        model: request.model,
        usage: { promptTokens: 30, completionTokens: 12, totalTokens: 42 },
        providerRequestId: 'assistant-browser-request',
        elapsedMs: 86,
      },
    })
  })

  await page.goto(`${origin}/login`, { waitUntil: 'networkidle' })
  assert.equal(await page.getByRole('button', { name: '打开 MathSea AI 助手' }).isVisible(), true)

  await page.goto(`${origin}/problems/P10002`, { waitUntil: 'networkidle' })
  const launcherBox = await page.getByRole('button', { name: '打开 MathSea AI 助手' }).boundingBox()
  await page.mouse.move(launcherBox.x + launcherBox.width / 2, launcherBox.y + launcherBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(1420, 28, { steps: 8 })
  await page.mouse.up()
  const restoreButton = page.getByRole('button', { name: '显示 MathSea AI 学习助手' })
  assert.equal(await restoreButton.isVisible(), true)
  const restoreBox = await restoreButton.boundingBox()
  await page.mouse.move(restoreBox.x + restoreBox.width / 2, restoreBox.y + restoreBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(1150, 150, { steps: 8 })
  await page.mouse.up()
  assert.equal(await page.getByRole('button', { name: '打开 MathSea AI 助手' }).isVisible(), true)
  await page.getByRole('button', { name: '打开 MathSea AI 助手' }).click()
  await page.waitForTimeout(220)
  const resetSizeButton = await page.getByRole('button', { name: '恢复默认对话框大小' }).boundingBox()
  const closeButton = await page.getByRole('button', { name: '关闭 AI 助手' }).boundingBox()
  assert.deepEqual(
    [Math.round(resetSizeButton.width), Math.round(resetSizeButton.height)],
    [36, 36],
  )
  assert.deepEqual(
    [Math.round(closeButton.width), Math.round(closeButton.height)],
    [36, 36],
  )
  const drawerBeforeResize = await page.getByRole('dialog', { name: 'MathSea AI 学习助手' }).boundingBox()
  const resizeCorner = await page.getByRole('button', { name: '调整对话框宽度和高度' }).boundingBox()
  await page.mouse.move(resizeCorner.x + resizeCorner.width / 2, resizeCorner.y + resizeCorner.height / 2)
  await page.mouse.down()
  await page.mouse.move(resizeCorner.x + 90, resizeCorner.y - 90, { steps: 8 })
  await page.mouse.up()
  const drawerAfterResize = await page.getByRole('dialog', { name: 'MathSea AI 学习助手' }).boundingBox()
  assert.equal(drawerAfterResize.width < drawerBeforeResize.width, true)
  assert.equal(drawerAfterResize.height < drawerBeforeResize.height, true)
  await page.getByRole('button', { name: 'Qwen 百炼' }).click()
  await page.getByLabel('API Key').fill('assistant-browser-key')
  await page.getByRole('button', { name: '测试连接' }).click()
  await page.getByText('连接成功 · 42 Token', { exact: true }).waitFor()
  await page.getByRole('button', { name: '返回对话' }).click()

  assert.equal(await page.getByText(/P10002 · 2024 年全国甲卷/).isVisible(), true)
  await page.getByRole('button', { name: /给一个提示/ }).click()
  await page.getByText('先求导，观察导函数零点与符号变化。', { exact: true }).waitFor()
  assert.equal(relayRequests[1].taskType, 'assistant-hint')
  assert.match(relayRequests[1].messages.at(-1).content, /f\(x\)=x³−3x²\+a/)
  assert.equal(await page.getByText('真实请求', { exact: true }).isVisible(), true)
  assert.equal(await page.getByText('42', { exact: true }).isVisible(), true)
  assert.equal(await page.getByText(/assistant-browser-request/).isVisible(), true)

  await page.getByRole('button', { name: /给一个提示/ }).click()
  await page.getByText('缓存命中', { exact: true }).waitFor()
  assert.equal(relayRequests.length, 2)

  await page.getByText('设置', { exact: true }).click()
  await page.getByRole('button', { name: '返回对话' }).click()
  await page.getByRole('button', { name: /寻找相似题/ }).click()
  await page.waitForURL('**/similar-problems**')
  await page.getByText('外部 API', { exact: true }).click()
  assert.equal(await page.getByLabel(/^模型名称/).inputValue(), 'qwen3.8-flash')
  assert.equal(await page.getByLabel(/API Key/).inputValue(), 'assistant-browser-key')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '打开 MathSea AI 助手' }).click()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('button', { name: '打开 MathSea AI 助手' }).isVisible(), true)
  assert.equal(pageErrors.length, 0)
  console.log('AI assistant: context, shared BYOK settings, calls, cache, metadata and mobile layout passed')
})()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server?.kill()
  })

/* global require, __dirname, process */
