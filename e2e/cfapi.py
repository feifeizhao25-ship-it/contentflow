import json, urllib.request, time
def call(port, method, path, data=None, tok=None, timeout=170, hdr=None):
    h={'content-type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    if hdr: h.update(hdr)
    r=urllib.request.Request(f'http://127.0.0.1:{port}/api/v1'+path, data=(json.dumps(data).encode() if data is not None else None), headers=h, method=method)
    t=time.time()
    try:
        b=urllib.request.urlopen(r,timeout=timeout).read(); code=200
    except urllib.error.HTTPError as e: b=e.read(); code=e.code
    except Exception as e: return 0,str(e),round(time.time()-t,1)
    try: b=json.loads(b)
    except Exception: b=b.decode('utf8','replace')
    return code,b,round(time.time()-t,1)
