const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out = process.env.EVIDENCE_DIR || '/tmp/contentflow-cover-evidence';
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
try {
  for (const width of [390,1440]) {
    const context = await browser.newContext({viewport:{width,height:900}});
    await context.addCookies([{name:'ff_token',value:'TEST_FIXTURE_NOT_REAL_LOGIN',url:'http://127.0.0.1:3433'}]);
    const page = await context.newPage();
    let calls=0;
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data = {};
      if (path.endsWith('/billing/subscription')) data={plan:'pro',aiTokens:{limit:50000,used:0,remaining:50000,imageTokenEquivalent:2500}};
      if (path.endsWith('/accounts')) data=[];
      if (path.endsWith('/auth/me')) data={id:'fixture',name:'界面测试用户',role:'owner'};
      if (path.endsWith('/ai/generate/image')) {
        calls++;
        data = calls===1 ? {url:'https://fixture.example/cover.png'} : calls===2 ? {} : {url:'https://fixture.example/broken.png'};
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
    });
    await page.route('**/cover.png', route => route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#d1fae5"/><text x="40" y="160" font-size="30" fill="#065f46">TEST FIXTURE - preserved cover</text></svg>'}));
    await page.route('**/broken.png', route => route.fulfill({status:404,body:'not found'}));
    await page.goto('http://127.0.0.1:3433/studio?topic=封面空响应回归测试', {waitUntil:'networkidle'});
    await page.getByRole('button',{name:'生成封面',exact:true}).click();
    await page.getByRole('button',{name:'重新生成',exact:true}).waitFor();
    const before = await page.getByAltText('封面预览',{exact:true}).getAttribute('src');
    await page.getByRole('button',{name:'重新生成',exact:true}).click();
    const alert = page.getByRole('alert').filter({hasText:'未收到有效的封面图片'});
    await alert.waitFor();
    assert.equal(calls,2);
    assert.equal(await page.getByAltText('封面预览',{exact:true}).getAttribute('src'),before);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
    await page.screenshot({path:`${out}/cover-${width}.png`,fullPage:true});
    await fs.writeFile(`${out}/cover-${width}.txt`,await page.locator('body').innerText());
    await page.getByRole('button',{name:'重新生成',exact:true}).click().catch(async error => { console.error('DEBUG', await page.locator('button').evaluateAll(nodes => nodes.map(n => ({text:n.textContent,html:n.outerHTML,rect:n.getBoundingClientRect().toJSON()})).filter(n=>n.text.includes('重新')))); throw error; });
    await page.getByAltText('封面预览',{exact:true}).scrollIntoViewIfNeeded();
    await page.getByRole('alert').filter({hasText:'封面图片加载失败'}).waitFor();
    assert.equal(calls,3);
    await page.screenshot({path:`${out}/broken-${width}.png`,fullPage:true});
    await fs.writeFile(`${out}/broken-${width}.txt`,await page.locator('body').innerText());
    await context.close();
    console.log(`PASS ${width}: empty generation preserves previous cover; broken image shows persistent error. Fixture API, not live model.`);
  }
} finally {await browser.close();}
