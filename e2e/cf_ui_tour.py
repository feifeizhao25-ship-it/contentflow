import asyncio, sys, json; sys.path.insert(0,'/workspace/ui_full_test/run')
from fw import *
PW='Test@12345Aa'
EM={'c1':'xhs.beauty@example.cn','c2':'dy.knowledge@example.cn','g1':'tiktok.creator@example.com','g2':'yt.educator@example.com','g3':'b2b.marketer@example.com','c3':'wx.finance@example.cn'}
JS="()=>[...document.querySelectorAll('flt-semantics')].map(e=>{const r=e.getBoundingClientRect();return {role:e.getAttribute('role'),t:(e.getAttribute('aria-label')||e.textContent||'').slice(0,24),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}}).filter(o=>o.w>0&&o.w<390&&o.h>0)"
async def main(pid):
    cn=pid.startswith('c'); s=await Sess('cfui_'+pid, locale='zh-CN' if cn else 'en-US', tz='Asia/Shanghai' if cn else 'America/Chicago').start()
    await s.goto('https://localhost:%d/'%(9101 if cn else 9102), wait=7000)
    els=await s.pg.evaluate(JS); print(json.dumps(els,ensure_ascii=False)[:1500],flush=True)
    await s.tap_xy(195,379); await s.type(EM[pid]); await s.tap_xy(195,443); await s.type(PW)
    await s.tap_xy(195,579,6000); await s.sem(); print(s.pg.url, await s.texts(),flush=True)
    log=[]
    async def snap(label):
        await s.sem(); t=await s.texts(); f=await s.shot(label,tall=1500); els=await s.pg.evaluate(JS)
        log.append({'label':label,'shot':f.split('/')[-1],'texts':t,'buttons':[e for e in els if e['role']=='button'],'api':list(s.net)[-8:]}); s.net.clear()
        json.dump(log,open(f'../out/cf_ui_{pid}.json','w'),ensure_ascii=False,indent=1); print(label,[x[:30] for x in t][:14],flush=True)
    await snap('home')
    for i,nm in enumerate(['create','materials','review','me']):
        await s.tap_xy(118+76.5*i,805,3500); await snap(nm)
    await s.close()
if __name__=="__main__": asyncio.run(main(sys.argv[1]))
