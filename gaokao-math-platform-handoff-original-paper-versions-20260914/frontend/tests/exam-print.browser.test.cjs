const { getTestPort, browserExecutable } = require('./browser-support.cjs')
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..')
const fixtures = require('./question-layout.fixture.json')
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
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/**', (r) =>
    r.fulfill({
      json: r.request().url().includes('auth/me')
        ? { authenticated: false }
        : { items: [], pagination: { total: 0 } },
    }),
  )
  const choices = [
    'A. $1$ B. $2$ C. $3$ D. $4$',
    'A. 函数在整个定义域上单调递增 B. 函数在整个定义域上单调递减 C. 函数在部分区间上单调递增 D. 函数在部分区间上单调递减',
    'A. 对任意给定的正实数，均存在满足题目中全部条件的实数使得等式成立 B. $2$ C. $3$ D. $4$',
  ]
  const items = Array.from({ length: 19 }, (_, i) => {
    const type =
      i < 8 ? 'single-choice' : i < 11 ? 'multiple-choice' : i < 14 ? 'fill-blank' : 'solution'
    return {
      score: i < 8 ? 5 : i < 11 ? 6 : i < 14 ? 5 : [13, 15, 15, 17, 17][i - 14],
      space: 0,
      problem: {
        id: `EXAM${i}`,
        type,
        assets: [],
        content:
          i < 11
            ? `已知函数 $f(x)=x^2-2x+1$，下列结论正确的是（　）\n${choices[i % 3]}`
            : i < 14
              ? '已知 $x>0$，则 $x+\\frac{1}{x}$ 的最小值为__________。'
              : fixtures[1].content,
      },
    }
  })
  const draft = { version: 1, title: '2026 年高考数学模拟试卷', size: '16k', items }
  await page.addInitScript(
    (draft) => localStorage.setItem('mathsea:paper-draft:v1', JSON.stringify(draft)),
    draft,
  )
  await page.goto(origin + '/paper/edit', { waitUntil: 'networkidle' })
  const ready = async () => {
    await page.waitForTimeout(200)
    await page.waitForFunction(
      () => !document.querySelector('.paper-status')?.textContent.includes('正在排版'),
    )
  }
  await ready()
  await page.getByRole('button', { name: '预览打印', exact: true }).click()
  await ready()
  assert.equal(await page.locator('.paper-measure .paper-section-heading').count(), 4)
  assert.equal(await page.locator('.paper-measure .paper-item-score').count(), 5)
  assert.ok(
    (await page.locator('.paper-canvas .paper-instructions').innerText()).includes('150 分'),
  )
  const geometry = await page.locator('.paper-measure').evaluate((el) => {
    const sheet = el.getBoundingClientRect(),
      style = getComputedStyle(el)
    return {
      width: sheet.width,
      padding: [style.paddingTop, style.paddingLeft].map(parseFloat),
      columns: [...el.querySelectorAll('.paper-choices')].map((c) =>
        c.style.getPropertyValue('--choice-columns'),
      ),
      overflow: [...el.querySelectorAll('.paper-choice-content')].some(
        (c) => c.scrollWidth > c.clientWidth + 1,
      ),
      headers: [...el.querySelectorAll('.paper-section-heading')].map(
        (h) => getComputedStyle(h).fontSize,
      ),
    }
  })
  assert.ok(Math.abs(geometry.width - (185 * 96) / 25.4) < 1)
  assert.ok(Math.abs(geometry.padding[0] - (20 * 96) / 25.4) < 1)
  assert.ok(Math.abs(geometry.padding[1] - (22 * 96) / 25.4) < 1)
  assert.deepEqual(new Set(geometry.columns), new Set(['4', '2', '1']))
  assert.equal(geometry.overflow, false, 'long choices wrap within their columns')
  assert.ok(geometry.headers.every((size) => size === '14px'))
  // Every question has contiguous fragments and stays above the footer on every page.
  const fragments = await page.locator('.paper-canvas .paper-fragment').evaluateAll((els) =>
    els.map((el) => {
      const rect = el.getBoundingClientRect(),
        sheet = el.closest('.paper-sheet')
      return {
        id: el.dataset.paperId,
        bottom: rect.bottom,
        footer: sheet.querySelector('footer').getBoundingClientRect().top,
      }
    }),
  )
  assert.equal(new Set(fragments.map((f) => f.id)).size, 19)
  assert.ok(
    fragments.every((f) => f.bottom < f.footer),
    'question contents never cover page numbers',
  )
  await page.evaluate(() => {
    window.print = () => {
      window.printed = true
    }
  })
  const print = async (name) => {
    await page.evaluate(() => {
      window.printed = false
    })
    await page.getByRole('button', { name: '打印 / 存为 PDF', exact: true }).click()
    await page.waitForFunction(() => window.printed)
    assert.equal(
      await page.locator('#paper-print-root .paper-sheet').count(),
      await page.locator('.paper-canvas .paper-sheet').count(),
    )
    await page.emulateMedia({ media: 'print' })
    assert.equal(
      await page
        .locator('#paper-print-root .paper-question-text')
        .first()
        .evaluate((el) => getComputedStyle(el).fontSize),
      '14px',
    )
    assert.equal(
      await page
        .locator('#paper-print-root .paper-choices')
        .first()
        .evaluate((el) => getComputedStyle(el).fontSize),
      '14px',
    )
    await page.pdf({
      path: path.join(root, `.tmp/exam-${name}.pdf`),
      preferCSSPageSize: true,
      printBackground: true,
    })
    await page.emulateMedia({ media: 'screen' })
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  }
  await print('16k')
  await page.getByRole('button', { name: '试卷设置', exact: true }).click()
  await page.getByLabel('纸张尺寸').selectOption('a4')
  await page.getByRole('button', { name: '关闭试卷设置', exact: true }).click()
  await ready()
  await print('a4')
  assert.deepEqual(errors, [])
  console.log(
    'Exam print: 19 questions / 150 points, 4 sections, 4/2/1 options, margins, overflow, multi-page 16k/A4 PDF passed',
  )
})()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    if (browser) await browser.close()
    if (server) server.kill()
  })
