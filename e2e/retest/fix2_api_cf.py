"""fix2 retest for 分发侠: base backend (:4289 cn / :4290 global) vs fix2 backend (:4294 cn / :4295 global)."""
import sys, json, re, time, os
sys.path.insert(0, '/workspace/ui_full_test/run')
from cfapi import call
CJK = re.compile(r'[\u3400-\u9fff]')
PW = 'Test@12345Aa'
def unwrap(b):
    while isinstance(b, dict) and 'success' in b and isinstance(b.get('data'), (dict, list)): b = b['data']
    return b
def run(label, port, market, suffix):
    gl = market == 'global'; o = {'label': label, 'port': port, 'market': market}
    email = f'fix2.{label}.{suffix}.{market}@example.{"com" if gl else "cn"}'
    call(port, 'POST', '/auth/register', {'email': email, 'password': PW, 'name': 'Fix2 Tester', 'agreedToTerms': True})
    st, j, _ = call(port, 'POST', '/auth/login', {'email': email, 'password': PW})
    tok = unwrap(j)['token'] if st == 200 else None; o['login'] = bool(tok)
    risky = ('This supplement cures anxiety in 3 days, guaranteed. FDA approved.' if gl else '这款面霜100%有效，7天根治痘痘，全网第一，国家药监局认证。')
    for key, body in (('compliance', {'text': risky}), ('compliance_US', {'text': risky, 'targetMarket': 'US'}), ('compliance_bad_market', {'text': risky, 'targetMarket': 'ZZ'})):
        st, b, _ = call(port, 'POST', '/ai/compliance/check', body, tok); u = unwrap(b)
        o[key] = {'status': st, 'keys': sorted(u.keys()) if isinstance(u, dict) else str(b)[:150], 'level': u.get('level') if isinstance(u, dict) else None,
                  'hitCounts': u.get('hitCounts') if isinstance(u, dict) else None, 'rulesChecked': u.get('rulesChecked') if isinstance(u, dict) else None,
                  'notChecked': (u.get('notChecked') or [])[:4] if isinstance(u, dict) else None, 'disclosureHint': u.get('disclosureHint') if isinstance(u, dict) else None}
    material = ('Acme Mug: 350 ml ceramic, dishwasher safe, ships in recycled packaging.' if gl else '星河保温杯：容量350毫升，304不锈钢内胆，可机洗盖子。')
    topic = ('Write a launch post for our Acme Mug' if gl else '写一条星河保温杯的上新文案')
    body = {'topic': topic, 'platforms': ['tiktok' if gl else '小红书'], 'material': material}
    if gl: body['targetMarket'] = 'US'
    t = time.time(); st, b, _ = call(port, 'POST', '/ai/content-pack/generate' if False else '/content-pack/generate', body, tok); u = unwrap(b)
    txt = json.dumps(u, ensure_ascii=False)
    o['content_pack'] = {'status': st, 'seconds': round(time.time() - t, 1), 'keys': sorted(u.keys()) if isinstance(u, dict) else str(b)[:200],
                         'grounding': u.get('grounding') if isinstance(u, dict) else None, 'targetMarket': u.get('targetMarket') if isinstance(u, dict) else None,
                         'has_cjk': bool(CJK.search(txt)), 'head': txt[:300]}
    st, b, _ = call(port, 'GET', '/billing/subscription', None, tok); u = unwrap(b)
    o['subscription'] = {'status': st, 'keys': sorted(u.keys()) if isinstance(u, dict) else str(b)[:150], 'aiTokens': u.get('aiTokens') if isinstance(u, dict) else None}
    st, b, _ = call(port, 'GET', '/system/language' if False else '/health/language'); o['health_language'] = {'status': st, 'body': unwrap(b) if st == 200 else str(b)[:120]}
    return o
if __name__ == '__main__':
    out = '/workspace/ui_full_test/retest/fix2'; suffix = str(int(time.time()))[-6:]
    for label, ports in (('before', {'cn': 4289, 'global': 4290}), ('after', {'cn': 4294, 'global': 4295})):
        res = [run(label, p, m, suffix) for m, p in ports.items()]
        json.dump(res, open(f'{out}/cf_api_{label}.json', 'w'), ensure_ascii=False, indent=1)
        for r in res: print(label, r['market'], {k: (v.get('status') if isinstance(v, dict) and 'status' in v else v) for k, v in r.items()}, flush=True)
