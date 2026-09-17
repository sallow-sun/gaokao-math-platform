require('./browser-support.cjs')
const {chromium}=require('playwright')
const {spawn}=require('node:child_process')
const {setTimeout:delay}=require('node:timers/promises')
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'../..');let browser,server
;(async()=>{
  const port = String(await require('./browser-support.cjs').getTestPort())
  const origin = `http://127.0.0.1:${port}`

 server=spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',port,'--strictPort'],{cwd:path.join(root,'frontend'),windowsHide:true,stdio:'ignore'})
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await delay(100)}
 const chrome=process.env.CHROME_EXECUTABLE || (process.platform==='win32' && fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined)
 browser=await chromium.launch({executablePath:chrome,headless:true})
 const page=await browser.newPage({viewport:{width:1100,height:850},hasTouch:true}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/**',r=>r.fulfill({json:{authenticated:false}}))
 await page.goto(origin + '/',{waitUntil:'domcontentloaded'})
 await page.addStyleTag({content:fs.readFileSync(path.join(root,'frontend/src/assets/styles/account-profile.css'),'utf8')})
 await page.evaluate(async()=>{
  const {createApp,h}=await import('/node_modules/.vite/deps/vue.js')
  const Chart=(await import('/src/components/account/UserTagStatsChart.vue')).default
  const Type=(await import('/src/components/account/UserProblemTypeChart.vue')).default
  const MathText=(await import('/src/components/content/MathText.vue')).default
  document.body.innerHTML='<main class="account-profile-page" style="padding:32px"><div id="bug-visual"></div></main>'
  createApp({render:()=>h('div',{style:'max-width:960px;margin:auto'},[
    h(Type,{items:[{key:'single',label:'单选题',value:5},{key:'solution',label:'解答题',value:3}]}),
    h(Chart,{items:[{key:'geometry',label:'解析几何',segments:[{level:'yellow',count:2},{level:'blue',count:1}]}]}),
    h('section',{style:'background:white;margin-top:24px;padding:20px'},[h(MathText,{text:'已知椭圆 $E:\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$，求离心率。\n\n（1）求 $e$。\n\n（2）求点 $P$ 的轨迹。\n\n$$a_1+a_2+a_3+a_4+a_5+a_6+a_7+a_8+a_9+a_{10}=100$$\n$\\text{C．若 }l\\text{ 与 }E\\text{ 的唯一公共点为 }B\\text{，则 }E\\text{ 的焦点在直线 }AB\\text{ 上}$'})])
  ])}).mount('#bug-visual')
 })
 const row=page.getByRole('button',{name:/解析几何：共3道/})
 await row.hover()
 const tooltip=page.getByRole('tooltip')
 await tooltip.waitFor()
 assert.ok((await tooltip.innerText()).includes('YELLOW：2'))
 assert.ok((await tooltip.innerText()).includes('BLUE：1'))
 const math=page.locator('.math-text')
 assert.ok(await math.evaluate(e=>[...e.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).every(n=>!n.textContent.includes('\n\n'))))
 assert.equal(await math.evaluate(e=>getComputedStyle(e).overflowY),'visible')
 await page.screenshot({path:path.join(root,'.tmp/bug-statistics-desktop.png'),fullPage:true})
 await row.focus();await page.keyboard.press('Escape');assert.equal(await tooltip.count(),0)
 await page.setViewportSize({width:390,height:844})
 await row.tap();await tooltip.waitFor()
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2))
 assert.ok(await page.locator('.math-text .math-formula-scroll').last().evaluate(e=>e.scrollWidth>e.clientWidth && getComputedStyle(e).overflowX==='auto'))
 await page.screenshot({path:path.join(root,'.tmp/bug-statistics-mobile.png'),fullPage:true})
 assert.deepEqual(errors,[])
 console.log('PASS: visible difficulty breakdown, keyboard/touch, compact formulas, no body overflow')
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
