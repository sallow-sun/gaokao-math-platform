require('./browser-support.cjs')
const {chromium}=require('playwright')
const {spawn}=require('node:child_process')
const {setTimeout:delay}=require('node:timers/promises')
const path=require('node:path'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'../..')
let browser,server
;(async()=>{
  const port = String(await require('./browser-support.cjs').getTestPort())
  const origin = `http://127.0.0.1:${port}`

 server=spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',port,'--strictPort'],{cwd:path.join(root,'frontend'),windowsHide:true,stdio:'ignore'})
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await delay(100)}
 browser=await chromium.launch({executablePath:require('./browser-support.cjs').browserExecutable,headless:true})
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 const fixture=require('./question-layout.fixture.json').find(p=>p.id==='GS000010')
 const items=Array.from({length:4},(_,i)=>({...fixture,id:`GS00010${i}`}))
 let releaseTags,tagRequests=0,holdLists=false,listRequests=0
 const pending=[]
 await page.route('**/api/**',async route=>{
  const u=new URL(route.request().url());let body={}
  if(u.pathname.endsWith('/auth/me'))body={authenticated:false}
  else if(u.pathname==='/api/v1/curriculum')body=require('./curriculum.fixture.cjs')
  else if(u.pathname.endsWith('/tag-taxonomy')){
   tagRequests++
   await new Promise(resolve=>{releaseTags=resolve})
   body=require('../../backend/src/main/resources/tag-taxonomy.json')
  } else if(u.pathname==='/api/v1/problems'){
   listRequests++
   if(holdLists) await new Promise(resolve=>pending.push(resolve))
   const result=u.searchParams.getAll('tag').length>1 ? items.slice(1) : items
   body={items:result,pagination:{total:result.length,page:1,pageSize:20}}
  } else if(u.pathname.startsWith('/api/v1/problems/'))body={...items.find(p=>u.pathname.endsWith(p.id)),answer:'答案',solution:'解析',viewerState:{},uploader:{}}
  await route.fulfill({json:body}).catch(()=>{})
 })
 await page.goto(origin + '/problems',{waitUntil:'domcontentloaded'})
 const tags=page.getByRole('group',{name:'TAG',exact:true})
 await tags.getByRole('button',{name:'解析几何',exact:true}).waitFor()
 assert.equal(tagRequests,1)
 assert.ok(releaseTags,'TAG buttons are usable before the catalog response')
 releaseTags()
 await page.locator('article[data-problem-id="GS000100"]').waitFor()
 assert.equal(await page.locator('.bank-problem-print-content').count(),0,'no hidden print formula rendering')
 assert.equal(await page.locator('#list-view').count(),0,'only active view is mounted')
 holdLists=true
 await tags.getByRole('button',{name:'解析几何',exact:true}).click()
 await page.getByText('正在更新筛选结果…',{exact:true}).waitFor()
 assert.equal(await page.locator('#preview-view article').count(),4,'old results remain visible while loading')
 assert.equal(await page.locator('#preview-view').getAttribute('inert'),'')
 await tags.getByRole('button',{name:'数列',exact:true}).click()
 for(let i=0;i<100 && pending.length<2;i++)await delay(20)
 assert.equal(pending.length,2)
 pending.pop()()
 await page.locator('article[data-problem-id="GS000100"]').waitFor({state:'detached'})
 pending.pop()()
 await delay(200)
 assert.equal(await page.locator('#preview-view article').count(),3,'late old response cannot replace new results')
 holdLists=false
 const returnURL=page.url(), card=page.locator('article[data-problem-id="GS000102"]')
 await card.scrollIntoViewIfNeeded()
 const scroll=await page.evaluate(()=>scrollY)
 assert.ok(scroll>100)
 await card.locator('.bank-result-problem-panel-view-card-content').click({position:{x:12,y:12}})
 await page.waitForURL('**/problems/GS000102')
 holdLists=true
 await page.goBack({waitUntil:'domcontentloaded'})
 await page.waitForURL(returnURL)
 await card.waitFor()
 assert.equal(await page.locator('#preview-view article').count(),3,'return snapshot appears before revalidation')
 await delay(200)
 assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scroll)<90,'back restores reading position')
 assert.equal(tagRequests,1,'return visit shares the fresh catalog request')
 for(let i=0;i<100 && !pending.length;i++)await delay(20)
 pending.pop()()
  await page.getByText('正在更新筛选结果…',{exact:true}).waitFor({state:'detached'})
  holdLists=false
  await card.locator('.bank-result-problem-panel-view-card-content').click({position:{x:12,y:12}})
  await page.waitForURL('**/problems/GS000102')
  await page.getByRole('link',{name:'题库',exact:true}).first().click()
  await page.waitForURL(returnURL)
  await page.getByText('正在更新筛选结果…',{exact:true}).waitFor({state:'detached'})
  await page.evaluate(()=>{ window.print=()=>{ window.__printedFormulas=document.querySelectorAll('.bank-problem-print-content .katex').length } })
  await card.getByRole('button',{name:'打印',exact:true}).click()
  await page.waitForFunction(()=>window.__printedFormulas>0)
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')))
 await page.screenshot({path:path.join(root,'.tmp/problems-performance.png')})
 assert.deepEqual(errors,[])
 assert.ok(listRequests>=4)
 console.log('PASS: immediate TAGs with delayed API, one catalog request, retained results, stale-response isolation, lazy views/print, back snapshot and scroll')
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
