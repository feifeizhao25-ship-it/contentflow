"""fix2 UI retest 分发侠: usage: fix2_ui_cf.py cn|gl before|after  (tabs: home/create/materials/review/me)"""
import asyncio, sys, json, urllib.request
sys.path.insert(0, '/workspace/ui_full_test/run')
import fw
OUT = '/workspace/ui_full_test/retest/fix2/shots'; fw.SHOTS = OUT
from fw import *
PW = 'Test@12345Aa'
EDGE = {('cn', 'after'): 9711, ('gl', 'after'): 9712, ('cn', 'before'): 9713, ('gl', 'before'): 9714}
API = {'cn': 4294, 'gl': 4295}
def reg(port, email):
    r = urllib.request.Request(f'http://127.0.0.1:{port}/api/v1/auth/register', data=json.dumps({'email': email, 'password': PW, 'name': 'Fix2 UI', 'agreedToTerms': True}).encode(), headers={'content-type': 'application/json'}, method='POST')
    try: urllib.request.urlopen(r, timeout=30)
    except Exception as e: print('register', e)
JS = "()=>[...document.querySelectorAll('flt-semantics')].map(e=>{const r=e.getBoundingClientRect();return {role:e.getAttribute('role'),t:(e.getAttribute('aria-label')||e.textContent||'').slice(0,40),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}}).filter(o=>o.w>0&&o.w<390&&o.h>0)"
async def main(ed, ver):
    cn = ed == 'cn'; email = f'fix2.ui.cf2.{ver}@example.{"cn" if cn else "com"}'
    reg(API[ed], email)
    s = await Sess(f'cf_{ed}_{ver}', locale='zh-CN' if cn else 'en-US', tz='Asia/Shanghai' if cn else 'America/Chicago').start()
    await s.goto(f'https://localhost:{EDGE[(ed, ver)]}/', wait=7000)
    await s.tap_xy(195, 379); await s.type(email); await s.tap_xy(195, 443); await s.type(PW)
    await s.tap_xy(195, 579, 6000); await s.sem(); print(s.pg.url, await s.texts(), flush=True)
    log = []
    async def snap(label, tall=1500):
        await s.sem(); t = await s.texts(); f = await s.shot(label, tall=tall); els = await s.pg.evaluate(JS)
        log.append({'label': label, 'shot': f.split('/')[-1], 'texts': t, 'buttons': [e for e in els if e['role'] == 'button']})
        json.dump(log, open(f'{OUT}/cf_{ed}_{ver}.json', 'w'), ensure_ascii=False, indent=1); print(label, [x[:30] for x in t][:14], flush=True)
    await snap('home')
    for i, nm in enumerate(['create', 'materials', 'review', 'me']):
        await s.tap_xy(118 + 76.5 * i, 805, 3500); await snap(nm, tall=2200 if nm in ('create', 'me') else 1500)
    await s.close()
asyncio.run(main(sys.argv[1], sys.argv[2]))
