require('./browser-support.cjs')
const {chromium}=require('playwright')
const {spawn}=require('node:child_process')
const {setTimeout:delay}=require('node:timers/promises')
const path=require('node:path'), fs=require('node:fs'), assert=require('node:assert/strict')
const root=path.resolve(__dirname,'../..')
let browser,server
;(async()=>{
  const port = String(await require('./browser-support.cjs').getTestPort())
  const origin = `http://127.0.0.1:${port}`

  server=spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',port,'--strictPort'],{cwd:path.join(root,'frontend'),windowsHide:true,stdio:'ignore'})
  for(let n=0;n<100;n++){try{if((await fetch(origin)).ok)break}catch{}await delay(100)}
  const chrome=process.env.CHROME_EXECUTABLE||(process.platform==='win32'&&fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)
  browser=await chromium.launch({executablePath:chrome,headless:true})
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  let query=null,fail=false
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url())
    let body={},status=200
    if(url.pathname==='/api/v1/curriculum')body=require('./curriculum.fixture.cjs')
    else if(url.pathname==='/api/v1/problems/tag-taxonomy')body=require('../../backend/src/main/resources/tag-taxonomy.json')
    else if(url.pathname==='/api/v1/auth/me')body={authenticated:false}
    else if(url.pathname==='/api/v1/problems'){
      query=url.searchParams
      if(fail){status=503;body={error:{message:'暂时不可用'}}}
      else body={items:[],pagination:{page:1,pageSize:20,total:0,hasNext:false}}
    }
    else if(url.pathname==='/api/v1/problem-stats')body={total:0,yearCount:0,tagCount:0}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  })
  await page.goto(origin + '/problems',{waitUntil:'networkidle'})
  await page.screenshot({path:path.join(root,'.tmp/filter-desktop.png'),fullPage:true})
  await page.getByRole('button',{name:'高一上',exact:true}).click()
  await page.waitForURL('**learning=true**')
  await page.waitForTimeout(300)
  assert.equal(query.get('learning'),'true'); assert.deepEqual(query.getAll('learned'),['A11','A12','A13','A14','A15'])
  await page.getByRole('button',{name:'自定义',exact:true}).click()
  const picker=page.getByRole('region',{name:'自定义学习进度'})
  await picker.getByRole('button',{name:'选择性必修第二册'}).click()
  await picker.getByLabel(/A42/).check()
  await page.screenshot({path:path.join(root,'.tmp/filter-expanded.png'),fullPage:true})
  await page.getByRole('button',{name:'应用筛选',exact:true}).click()
  await page.waitForTimeout(300); assert.ok(query.getAll('learned').includes('A42'))
  const shared=page.url(); await page.reload({waitUntil:'networkidle'}); assert.equal(page.url(),shared)
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:path.join(root,'.tmp/curriculum-mobile.png'),fullPage:true})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2))
  await page.getByRole('button',{name:/自定义 ·/}).click()
  await page.screenshot({path:path.join(root,'.tmp/filter-mobile-expanded.png'),fullPage:true})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2))
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'清除全部',exact:true}).click(); await page.waitForTimeout(300)
  assert.equal(query.get('learning'),null);assert.deepEqual(query.getAll('learned'),[])
  await page.getByRole('button',{name:'自定义',exact:true}).click()
  await page.getByRole('button',{name:'上次进度',exact:true}).click()
  await page.getByRole('button',{name:'应用筛选',exact:true}).click()
  await page.waitForTimeout(300); assert.ok(query.getAll('learned').includes('A42'))
  const tagGroup=page.getByRole('group',{name:'TAG',exact:true})
  await tagGroup.getByRole('button',{name:'解析几何',exact:true}).click()
  await page.waitForTimeout(300); assert.deepEqual(query.getAll('tag'),['解析几何'])
  assert.equal(query.get('learning'),'true')
  await tagGroup.getByRole('button',{name:'更多',exact:true}).click()
  const tagDialog=page.getByRole('dialog',{name:'所有 TAG',exact:true})
  const beforePin=page.url()
  await tagDialog.getByLabel('固定 复数',{exact:true}).check()
  assert.equal(page.url(),beforePin,'pinning must not change filtering')
  await tagDialog.getByRole('button',{name:'完成',exact:true}).click()
  assert.ok(await tagGroup.getByRole('button',{name:'复数',exact:true}).isVisible())
  await page.reload({waitUntil:'networkidle'})
  assert.ok(await tagGroup.getByRole('button',{name:'复数',exact:true}).isVisible())
  await tagGroup.getByRole('button',{name:'更多',exact:true}).click()
  await tagGroup.getByRole('button',{name:'不等式',exact:true}).click()
  await page.waitForTimeout(300); assert.ok(query.getAll('tag').includes('不等式'))
  await page.keyboard.press('Escape')
  assert.deepEqual(await page.locator('.bank-filter-group-label').allTextContents(),['年份','来源','题型','TAG','学习进度','题目难度'])
  // Failed progress queries must not substitute unclassified prototype questions.
  fail=true
  await page.getByRole('button',{name:'高一下',exact:true}).click();await page.waitForTimeout(500)
  assert.equal(await page.locator('.bank-result-problem-panel-view-card').count(),0)
  assert.deepEqual(errors,[])
  console.log('PASS: presets, exact chapters, shared URL, clear, mobile layout, no unclassified fallback on API failure')
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
