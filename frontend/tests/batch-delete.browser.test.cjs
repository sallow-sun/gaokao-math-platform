const {chromium}=require('playwright')
const {spawn}=require('node:child_process')
const {setTimeout:delay}=require('node:timers/promises')
const {browserExecutable,getTestPort}=require('./browser-support.cjs')
const path=require('node:path'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'../..')
let browser,server
;(async()=>{
 const port=String(await getTestPort()),origin=`http://127.0.0.1:${port}`
 server=spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',port,'--strictPort'],{cwd:path.join(root,'frontend'),windowsHide:true,stdio:'ignore'})
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await delay(100)}
 browser=await chromium.launch({executablePath:browserExecutable,headless:true})
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 let permission='MANAGER',deletedDrafts=[],deletedPublic=[]
 const drafts=[1,2,3].map(i=>({id:`00000000-0000-4000-8000-00000000000${i}`,title:`测试题${i}`,version:1,status:'DRAFT',original_number:String(i),original_id:`T${i}`,history:[],document:{title:`测试题${i}`,content:'题干 $x=1$',answer:'1',solution:'解析',tags:[],assets:[],imageReferences:[],originalMetadata:{}}}))
 const published=[{id:'GC000101',title:'公开题1'},{id:'GC000102',title:'公开题2'}]
 await page.route('**/api/**',async r=>{
  const p=new URL(r.request().url()).pathname,method=r.request().method();let body={}
  if(p.endsWith('/auth/me'))body={authenticated:true,user:{id:1,role:'ADMIN',username:'test'}}
  else if(p.endsWith('/auth/csrf'))body={token:'test',headerName:'X-XSRF-TOKEN'}
  else if(p.endsWith('/editorial/me'))body={id:1,permission}
  else if(p.endsWith('/editorial/papers')||p.endsWith('/admin/tags')||p.endsWith('/admin/sources'))body=[]
  else if(p.endsWith('/editorial/items')){const items=drafts.filter(d=>!deletedDrafts.includes(d.id));body={items,total:items.length,page:1}}
  else if(p.endsWith('/lease'))body=drafts.find(d=>p.includes(d.id))||{}
  else if(p.endsWith('/admin/problems')){const items=published.filter(d=>!deletedPublic.includes(d.id));body={items,pagination:{total:items.length,page:1}}}
  else if(p.endsWith('/problem-trash/drafts') && method==='POST'){
   const items=r.request().postDataJSON().items;assert.deepEqual(items.map(d=>d.version),[1,1]);deletedDrafts.push(...items.map(d=>d.id))
  } else if(p.includes('/problem-trash/drafts/')&&p.endsWith('/restore')) deletedDrafts=deletedDrafts.filter(id=>!p.includes(id))
  else if(p.endsWith('/problem-trash')){
   if(method==='POST')deletedPublic.push(...r.request().postDataJSON().numbers)
   else {const items=[...drafts.filter(d=>deletedDrafts.includes(d.id)).map(d=>({...d,kind:'draft'})),...published.filter(d=>deletedPublic.includes(d.id)).map(d=>({...d,kind:'published'}))];body={items,total:items.length,page:1}}
  } else if(p.endsWith('/admin/users'))body={items:[],pagination:{total:0}}
  else if(p.endsWith('/admin/stats'))body={}
  await r.fulfill({json:body})
 })
 await page.goto(origin+'/admin')
 await page.getByRole('button',{name:'开始 / 继续审核',exact:true}).click()
 await page.getByRole('button',{name:'批量删除',exact:true}).click()
 const toolbar=page.getByRole('group',{name:'批量删除题目',exact:true})
 await toolbar.getByLabel('选择当前页',{exact:true}).check()
 await page.getByLabel('选择初审题目 测试题3',{exact:true}).uncheck()
 page.once('dialog',d=>d.dismiss())
 await toolbar.getByRole('button',{name:'删除所选',exact:true}).click()
 assert.equal(deletedDrafts.length,0)
 page.once('dialog',d=>{assert.ok(d.message().includes('2 道初审草稿'));return d.accept()})
 await toolbar.getByRole('button',{name:'删除所选',exact:true}).click()
 await page.getByText('已将 2 道初审草稿移入回收站，可恢复',{exact:true}).waitFor()
 assert.equal(deletedDrafts.length,2)
 await page.locator('.editorial-preview h4').filter({hasText:'测试题3'}).waitFor()
 await page.getByRole('button',{name:'已发布',exact:true}).click()
 assert.equal(await toolbar.count(),0)
 await page.getByRole('button',{name:'批量删除',exact:true}).click()
 await toolbar.getByLabel('选择当前页',{exact:true}).check()
 page.once('dialog',d=>d.accept())
 await toolbar.getByRole('button',{name:'删除所选',exact:true}).click()
 await page.getByText('已移入回收站，可恢复',{exact:true}).waitFor()
 assert.deepEqual(deletedPublic,['GC000101','GC000102'])
 await page.getByRole('button',{name:'更多',exact:true}).click()
 await page.getByRole('button',{name:'回收站',exact:true}).click()
 const draftRow=page.locator('.recycle-bin .editorial-paper-row').filter({hasText:'测试题1'})
 assert.equal(await draftRow.getByRole('button',{name:'彻底删除',exact:true}).count(),0)
 page.once('dialog',d=>{assert.ok(d.message().includes('初审队列'));return d.accept()})
 await draftRow.getByRole('button',{name:'恢复',exact:true}).click()
 await page.getByText('已恢复',{exact:true}).waitFor()
 assert.equal(deletedDrafts.length,1)
 await page.getByRole('button',{name:'初审',exact:true}).click()
 await page.getByRole('button',{name:'批量删除',exact:true}).click()
 await page.setViewportSize({width:390,height:844})
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2))
 await page.screenshot({path:path.join(root,'.tmp/batch-delete-mobile.png'),fullPage:true})
 permission='EDITOR';await page.reload()
 await page.getByRole('heading',{name:'题目工作台',exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:'批量删除',exact:true}).count(),0)
 assert.deepEqual(errors,[])
 console.log('PASS: draft and published batch deletion, cancel, next question, selection isolation, draft restore, mobile and permissions')
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
