import sys, json
from cfapi import *
PW='Test@12345Aa'
P={
'c1':dict(port=4300,email='xhs.beauty@example.cn',name='小红书美妆博主',topic='秋冬干皮粉底液怎么选',platform='xhs',style='casual',kw=['干皮','粉底液'],
   risky='这款面霜100%有效，7天根治痘痘，全网第一，国家药监局认证，不满意不退款。'),
'c2':dict(port=4300,email='dy.knowledge@example.cn',name='抖音知识区UP主',topic='三分钟讲清楚公积金提取规则',platform='douyin',style='professional',kw=['公积金','提取'],
   risky='内部消息：稳赚不赔的理财产品，年化收益30%，保本保息，加我微信带你翻倍。'),
'c3':dict(port=4300,email='wx.finance@example.cn',name='公众号财经号',topic='如何看待新能源板块的投资机会',platform='wechat',style='professional',kw=['新能源','投资'],
   risky='这只基金明天必涨，闭眼买入，没有任何风险。'),
'c4':dict(port=4300,email='shop.local@example.cn',name='本地餐饮商家',topic='社区火锅店双十一团购活动文案',platform='xhs',style='casual',kw=['火锅','团购'],
   risky='我们是全国最好吃的火锅，治好了很多人的胃病。'),
'g1':dict(port=4302,email='tiktok.creator@example.com',name='TikTok Creator',topic='5 desk setup upgrades under $50',platform='tiktok',style='casual',kw=['desk setup','budget'],
   risky='This supplement cures anxiety in 3 days, guaranteed. FDA approved. Doctors hate it.'),
'g2':dict(port=4302,email='yt.educator@example.com',name='YouTube Educator',topic='How compound interest works, explained simply',platform='youtube',style='professional',kw=['compound interest','investing'],
   risky='Buy this coin now, guaranteed 10x returns by Friday, no risk at all.'),
'g3':dict(port=4302,email='b2b.marketer@example.com',name='LinkedIn B2B Marketer',topic='Why your SaaS onboarding emails get ignored',platform='linkedin',style='professional',kw=['SaaS','onboarding'],
   risky='Our product is the #1 rated tool in the world and 100% GDPR proof forever.'),
'g4':dict(port=4302,email='health.writer@example.com',name='Health Newsletter Writer',topic='Sleep hygiene habits backed by research',platform='newsletter',style='casual',kw=['sleep','habits'],
   risky='Stop taking your blood pressure medication, this herb replaces it completely.'),
}
def run(pid):
    c=P[pid]; port=c['port']; out={'persona':{k:c[k] for k in('name','topic','platform')},'steps':{}}; f=f'../out/cf_{pid}.json'
    def rec(k,res): out['steps'][k]={'status':res[0],'sec':res[-1],'body':res[1]}; json.dump(out,open(f,'w'),ensure_ascii=False,indent=1); print(pid,k,res[0],res[-1],flush=True)
    call(port,'POST','/auth/register',{'email':c['email'],'password':PW,'name':c['name'],'agreedToTerms':True})
    st,j,t=call(port,'POST','/auth/login',{'email':c['email'],'password':PW}); tok=j['data']['token']
    rec('ai_usage',call(port,'GET','/ai/usage',None,tok))
    rec('article',call(port,'POST','/ai/generate/article',{'topic':c['topic'],'style':c['style'],'platform':c['platform'],'keywords':c['kw']},tok))
    rec('script',call(port,'POST','/ai/generate/script',{'topic':c['topic'],'platform':c['platform'],'duration':60},tok))
    rec('titles',call(port,'POST','/ai/generate/titles',{'topic':c['topic'],'platform':c['platform'],'count':5},tok))
    rec('content_pack',call(port,'POST','/content-pack/generate',{'topic':c['topic'],'platforms':[c['platform']]},tok))
    rec('compliance_risky',call(port,'POST','/ai/compliance/check',{'text':c['risky']},tok))
    rec('compliance_sources',call(port,'GET','/ai/compliance-sources/status',None,tok))
    for k,pth in [('hot','/hot/list'),('persona','/persona'),('growth_plan','/growth/plan'),('growth_skills','/growth/skills'),('growth_rag','/growth/rag/status'),('plans','/billing/plans'),('subscription','/billing/subscription'),('analytics','/analytics/overview'),('points','/points/balance'),('gamification','/gamification/status'),('me','/users/me'),('competitor','/competitor'),('quests','/api/quests')]:
        rec(k,call(port,'GET',pth,None,tok))
if __name__=='__main__':
    for p in sys.argv[1:]: run(p)
