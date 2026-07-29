'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage(){
  const router=useRouter(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  async function submit(event:FormEvent){event.preventDefault();setLoading(true);setError('');try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.message||'Sign-in failed');router.replace('/');router.refresh()}catch(reason){setError(reason instanceof Error?reason.message:'Sign-in failed')}finally{setLoading(false)}}
  return <main className="shell"><section className="hero"><div><div className="eyebrow">Secure workspace</div><h1>Welcome back to your global command center.</h1><p>Provider credentials stay on the server. Publishing remains review-first and every market recommendation keeps its context.</p></div><form className="card stack" onSubmit={submit}><h2>Sign in</h2><label>Work email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Password<input type="password" required minLength={8} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} /></label>{error&&<p role="alert">{error}</p>}<button className="button" disabled={loading}>{loading?'Signing in…':'Enter workspace'}</button></form></section></main>
}
