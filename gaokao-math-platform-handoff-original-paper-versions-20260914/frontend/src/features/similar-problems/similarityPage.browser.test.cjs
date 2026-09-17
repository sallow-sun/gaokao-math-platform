const { browserExecutable, getTestPort } = require('../../../tests/browser-support.cjs')
const { spawn } = require('node:child_process')
const { Buffer } = require('node:buffer')
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

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {
      // Vite may still be starting; retry until the bounded loop ends.
    }
    await delay(100)
  }

  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const pageErrors = []
  const proxyRequests = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/api/**', (route) => route.fulfill({ json: { authenticated: false } }))
  await page.route('**/__mathsea_similarity_proxy', async (route) => {
    const request = route.request().postDataJSON()
    proxyRequests.push(request)
    const userContent = request.messages?.at(-1)?.content
    const hasImage = Array.isArray(userContent)
    const content = request.jsonMode
      ? JSON.stringify(hasImage ? {
          recognized_text: '在三棱锥 P-ABC 中，证明平面 PAB 垂直于平面 ABC。',
          knowledge_points: [],
          methods: [],
          strategy_signature: {},
          structure: [],
          difficulty: 0.78,
          confidence: 0.72,
        } : {
          recognized_text: request.taskType === 'similarity-feature-repair'
            ? '在三棱锥 P-ABC 中，证明平面 PAB 垂直于平面 ABC。'
            : '',
          knowledge_points: request.taskType === 'similarity-feature-repair' ? ['立体几何'] : ['导数', '函数零点'],
          methods: request.taskType === 'similarity-feature-repair' ? ['空间向量'] : ['构造函数', '隐零点'],
          strategy_signature: {
            trigger_conditions: ['函数存在两个零点'],
            goals: ['证明零点乘积估计'],
            operations: ['求导分析单调性', '利用零点关系消元'],
            key_transformations: ['隐零点代换'],
            constraints: ['参数范围'],
            branch_points: [],
          },
          structure: request.taskType === 'similarity-feature-repair' ? ['面面垂直证明'] : ['含参函数综合题'],
          difficulty: 0.78,
          confidence: 0.92,
        })
      : 'OK'
    await route.fulfill({ json: { content } })
  })

  await page.goto(origin, { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: /AI 同类题/ }).click()
  await page.waitForURL('**/similar-problems')
  assert.equal(await page.getByRole('heading', { name: '相似题推荐' }).isVisible(), true)

  await page.getByText('外部 API', { exact: true }).click()
  await page.getByRole('button', { name: 'DeepSeek', exact: true }).click()
  assert.equal(
    await page.getByLabel(/Chat Completions 地址/).inputValue(),
    'https://api.deepseek.com/chat/completions',
  )
  assert.equal(await page.getByLabel(/^模型名称/).inputValue(), 'deepseek-flash')
  await page.getByLabel(/API Key/).fill('browser-test-key')
  await page.getByRole('button', { name: '测试连接' }).click()
  await page.getByText('连接成功（仅验证短响应）', { exact: true }).waitFor()
  assert.equal(proxyRequests[0].endpoint, 'https://api.deepseek.com/chat/completions')
  assert.equal(proxyRequests[0].model, 'deepseek-flash')
  assert.equal(proxyRequests[0].apiKey, 'browser-test-key')
  assert.equal(proxyRequests[0].lowLatency, true)
  assert.equal(proxyRequests[0].jsonMode, false)

  await page.getByRole('button', { name: '开始匹配' }).click()
  await page.getByText('本次解析成功', { exact: true }).waitFor()
  assert.equal(proxyRequests[1].timeoutSeconds, 90)
  assert.equal(proxyRequests[1].lowLatency, true)
  assert.equal(proxyRequests[1].jsonMode, true)

  await page.getByText('离线规则', { exact: true }).click()

  await page.getByRole('button', { name: '开始匹配' }).click()
  await page.getByText('高置信推荐', { exact: true }).waitFor()
  assert.equal(await page.locator('.similarity-result-card h3').first().textContent(), '含参函数的隐零点与乘积估计')

  await page.getByLabel('上传数学题图片').setInputFiles({
    name: 'problem.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4nUAAAAASUVORK5CYII=', 'base64'),
  })
  await page.getByAltText('待识别的数学题图片').waitFor()
  assert.equal(await page.getByText('暂不支持图片识别', { exact: true }).isVisible(), true)
  await page.getByRole('button', { name: 'Qwen 百炼' }).click()
  await page.getByLabel(/我确认图片不含无关隐私/).check()
  await page.getByRole('button', { name: '识别图片并开始匹配' }).click()
  await page.getByText('图片识别题干', { exact: true }).waitFor()
  await page.getByText('在三棱锥 P-ABC 中，证明平面 PAB 垂直于平面 ABC。', { exact: true }).waitFor()
  const imageRequest = proxyRequests.find((request) => request.taskType === 'similarity-feature-extraction'
    && Array.isArray(request.messages.at(-1).content))
  const repairRequest = proxyRequests.find((request) => request.taskType === 'similarity-feature-repair')
  const imageContent = imageRequest.messages.at(-1).content
  assert.equal(imageRequest.model, 'qwen3.8-flash')
  assert.equal(imageContent[0].type, 'image_url')
  assert.match(imageContent[0].image_url.url, /^data:image\/png;base64,/)
  assert.equal(imageContent[1].type, 'text')
  assert.equal(repairRequest.model, 'qwen3.8-flash')
  assert.equal(typeof repairRequest.messages.at(-1).content, 'string')
  assert.match(repairRequest.messages.at(-1).content, /以下题干已从图片中识别/)
  assert.equal(pageErrors.length, 0)

  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  console.log('Similar problems: route, same-origin API relay, ranking and mobile width passed')
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
