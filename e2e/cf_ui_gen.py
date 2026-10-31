import asyncio, sys, json; sys.path.insert(0,'/workspace/ui_full_test/run')
from fw import *
from cf_ui_tour import EM, PW, JS
from cf_battery import P
async def main(pid):
    cn=pid.startswith('c'); s=await Sess('cfgen_'+pid, locale='zh-CN' if cn else 'en-US', tz='Asia/Shanghai' if cn else 'America/Chicago').start()
    await s.goto('https://localhost:%d/'%(9101 if cn else 9102), wait=7000)
    await s.tap_xy(195,379); await s.type(EM[pid]); await s.tap_xy(195,443); await s.type(PW); await s.tap_xy(195,579,6000)
    await s.tap_xy(118,805,3000)
    await s.tap_xy(195,208,800); await s.type(P[pid]['topic']); await s.shot('typed')
    await s.tap_xy(195,291,2000)
    prev=0
    for w in range(40):
        await s.pg.wait_for_timeout(3000); await s.sem(); t=await s.texts()
        if len(t)>14 and w>2: break
    await s.sem(); t=await s.texts(); f=await s.shot('generated',tall=3200)
    json.dump({'topic':P[pid]['topic'],'shot':f.split('/')[-1],'texts':t,'net':s.net[-6:]},open(f'../out/cf_ui_gen_{pid}.json','w'),ensure_ascii=False,indent=1)
    print(len(t),[x[:50] for x in t][:20]); await s.close()
if __name__=='__main__': asyncio.run(main(sys.argv[1]))
