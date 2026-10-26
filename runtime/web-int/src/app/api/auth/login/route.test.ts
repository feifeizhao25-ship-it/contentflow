/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from './route';
const fetchMock = jest.fn();
beforeEach(()=>{global.fetch=fetchMock;fetchMock.mockReset()});
const request=()=>new NextRequest('http://localhost/api/auth/login',{method:'POST',body:JSON.stringify({email:'test@example.invalid',password:'local-test-only'})});
it.each([{}, {token:''}, {data:{token:42}}, {data:{token:'   '}}])('rejects upstream success without a valid token',async(body)=>{fetchMock.mockResolvedValue({ok:true,json:async()=>body});const res=await POST(request());expect(res.status).toBe(502);expect(res.headers.get('set-cookie')).toBeNull()});
it('returns safe English service failure on network rejection',async()=>{fetchMock.mockRejectedValue(new Error('private internal server address'));const res=await POST(request());expect(res.status).toBe(503);expect(await res.text()).not.toContain('private internal')});
it('does not leak upstream Chinese errors or credentials',async()=>{fetchMock.mockResolvedValue({ok:false,status:401,json:async()=>({message:'密码错误',token:'secret'})});const res=await POST(request());expect(res.status).toBe(401);expect(await res.text()).not.toMatch(/密码|secret/)});
it('sets HTTP-only cookie only for authenticated success',async()=>{fetchMock.mockResolvedValue({ok:true,json:async()=>({data:{token:'local-test-token',user:{id:'test-user'}}})});const res=await POST(request());expect(res.status).toBe(200);expect(res.headers.get('set-cookie')).toContain('HttpOnly');expect(await res.json()).toEqual({user:{id:'test-user'}})});
