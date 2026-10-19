import {chromium} from 'playwright';import fs from 'node:fs';
const root='/Users/feifei00/Documents/四项目UI完整证据-20261019/contentflow-output';fs.mkdirSync(root,{recursive:true});
const content='TEST FIXTURE — display completeness only. Not model output.\n\n'+Array.from({length:35},(_,i)=>`Paragraph ${i+1}: A reviewer checks audience, evidence, publication rights and account permissions before using this draft.\n\n`).join('')+'END OF COMPLETE TEST DRAFT';
const cases=[{name:'真实未登录',real:true},{name:'空响应错误',status:200,body:{data:{}}},{name:'额度限制',status:429,body:{message:'今日额度不足'}},{name:'服务失败',status:503,body:{message:'服务暂不可用'}},{name:'完整长文与图片提示词',status:200,body:{data:{content,visualPrompts:['TEST first prompt','TEST second prompt','TEST third prompt','TEST fourth prompt']}}}];
const rows=[];const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{for(const width of [390,1440])for(const c of cases){
 const ctx=await b.newContext({viewport:{width,height:900},locale:'en-US'});if(!c.real)await ctx.addCookies([{name:'ff_token',value:'ui-fixture-not-a-real-session',url:'http://127.0.0.1:3432',httpOnly:true}]);const p=await ctx.newPage();let apis=[];const pending=[];
 if(!c.real)await p.route('**/api/v1/ai/generate/article',r=>r.fulfill({status:c.status,contentType:'application/json',body:JSON.stringify(c.body)}));
 p.on('response',r=>{if(r.url().includes('/api/v1/ai/generate/article'))pending.push((async()=>apis.push({url:r.url(),status:r.status(),response_body:await r.json(),request_body:r.request().postDataJSON()}))())});
 await p.goto('http://127.0.0.1:3432/create',{waitUntil:'networkidle'});
 if(!c.real){await p.getByLabel('Topic or campaign brief').fill('Local UI verification: preserve the complete draft and all image prompts.');
 await p.getByRole('button',{name:'Generate review draft'}).click();
 if(c.name==='完整长文与图片提示词'){
  await p.getByTestId('draft-content').waitFor();if(await p.getByTestId('draft-content').textContent()!==content)throw new Error('truncated draft');
  if((await p.getByRole('button',{name:'Generate review draft'}).boundingBox()).height>100)throw new Error('form stretched by long output');
  if(await p.getByRole('listitem').count()!==4)throw new Error('missing image prompts');
 }else{await p.getByRole('alert').filter({has:p.locator('p')}).waitFor();}}else{if(!p.url().includes('/login'))throw new Error('missing login guard');const r=await ctx.request.post('http://127.0.0.1:3432/api/v1/ai/generate/article',{data:{topic:'local unauthorized probe'}});if(r.status()!==401)throw new Error('missing API guard');apis.push({status:r.status(),response_body:await r.json()})}
 await Promise.all(pending);await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 const id=String(rows.length+1).padStart(3,'0');const text=await p.locator('body').innerText();
 if(/今日额度不足|服务暂不可用/.test(text))throw new Error('upstream error language leaked');
 const layout=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));if(layout.scrollWidth>width)throw new Error('horizontal overflow');
 await p.screenshot({path:root+'/'+id+'.png',fullPage:true});fs.writeFileSync(root+'/'+id+'.txt',text);fs.writeFileSync(root+'/'+id+'.api.json',JSON.stringify(apis,null,2));
 rows.push({id,profile:width+'px',scenario:c.name+(c.real?' · 真实本地未登录接口':' · 显式接口替身，仅验证显示与错误处理'),image:id+'.png',text:id+'.txt',api:id+'.api.json',layout,evidence:c.real?'actual local login redirect and proxy 401; no model request':'Playwright synthetic cookie and response fixture; not authenticated user, provider, membership or generation acceptance',capturedAt:new Date().toISOString()});await ctx.close();
 }fs.writeFileSync(root+'/manifest.json',JSON.stringify(rows,null,2));console.log('10 browser scenarios passed; 2 real local 401 and 8 explicit response fixtures');}finally{await b.close()}
