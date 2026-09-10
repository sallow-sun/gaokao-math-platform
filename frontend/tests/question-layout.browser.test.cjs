require('./browser-support.cjs')
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'../..'), fixtures=require('./question-layout.fixture.json')
let browser,server
;(async()=>{
  const port = String(await require('./browser-support.cjs').getTestPort())
  const origin = `http://127.0.0.1:${port}`

 server=spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',port,'--strictPort'],{cwd:path.join(root,'frontend'),windowsHide:true,stdio:'ignore'})
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await delay(100)}
 const chrome=process.env.CHROME_EXECUTABLE || (process.platform==='win32' && fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)
 browser=await chromium.launch({executablePath:chrome,headless:true})
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/**',async r=>{
  const u=new URL(r.request().url());let body={}
  if(u.pathname==='/api/v1/auth/me')body={authenticated:false}
  else if(u.pathname==='/api/v1/curriculum')body=require('./curriculum.fixture.cjs')
  else if(u.pathname==='/api/v1/problems/tag-taxonomy')body=require('../../backend/src/main/resources/tag-taxonomy.json')
  else if(u.pathname==='/api/v1/problems')body={items:fixtures,pagination:{page:1,pageSize:20,total:2,hasNext:false}}
  else if(u.pathname.startsWith('/api/v1/problems/'))body={...fixtures.find(p=>u.pathname.endsWith(p.id)),answer:'答案',solution:'解析',viewerState:{},uploader:{}}
  else if(u.pathname==='/api/v1/problem-stats')body={total:2,yearCount:1,tagCount:2}
  await r.fulfill({json:body})
 })
 await page.goto(origin + '/problems',{waitUntil:'networkidle'})
 const card=page.locator('article.bank-result-problem-panel-view-card[data-problem-id="GS000010"]')
 await card.waitFor()
 const screen=card.locator('.bank-problem-screen-content')
 const second=screen.locator(':scope > .math-question-item').nth(1)
 assert.equal(await second.locator('.math-question-body .math-question-item').count(),2)
 const major=await second.boundingBox(), body=await second.locator(':scope > .math-question-body').boundingBox(), child=await second.locator('.math-question-body .math-question-item').first().boundingBox()
 assert.ok(body.x>major.x && child.x>=body.x)
 assert.equal(await page.locator('.bank-problem-screen-content .math-formula-scroll').count(),0,'short formulas must stay inline without scrollbars')
 const url=page.url()
 await card.getByRole('checkbox').check();assert.equal(page.url(),url)
 await card.getByRole('button',{name:'快速查看题解',exact:true}).click();assert.equal(page.url(),url)
 await card.getByRole('button',{name:'收起题解',exact:true}).click()
 await screen.evaluate(el=>{const selection=getSelection(),range=document.createRange();range.selectNodeContents(el);selection.removeAllRanges();selection.addRange(range);el.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0}))})
 assert.equal(page.url(),url,'copying text does not navigate')
 await page.evaluate(()=>getSelection().removeAllRanges())
 await card.locator('.bank-result-problem-panel-view-card-content').click({position:{x:12,y:12}})
 await page.waitForURL('**/problems/GS000010')
 await page.goto(origin + '/problems',{waitUntil:'networkidle'})
 const tags=page.getByRole('group',{name:'TAG',exact:true})
 await tags.getByRole('button',{name:'更多',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'所有 TAG'})
 for(const choice of await dialog.locator('.bank-filter-catalog-choice').all()) {
  assert.ok((await choice.boundingBox()).height<45)
  assert.ok(await choice.evaluate(el=>el.scrollWidth<=el.clientWidth+1))
 }
 await page.screenshot({path:path.join(root,'.tmp/new-bug-desktop.png'),fullPage:true})
 await page.setViewportSize({width:390,height:844})
 await page.waitForTimeout(200)
 for(const choice of await dialog.locator('.bank-filter-catalog-choice').all())assert.ok((await choice.boundingBox()).height<45)
 await page.keyboard.press('Escape')
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2))
 await page.screenshot({path:path.join(root,'.tmp/new-bug-mobile.png'),fullPage:true})
 await page.emulateMedia({media:'print'})
 assert.ok(await page.locator('.math-question-item').count()>0)
 assert.deepEqual(errors,[])
 console.log('PASS: nested indentation, short formulas, card navigation, selection/control isolation, TAG labels, mobile and print structure')
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
