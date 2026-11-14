'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from 'antd';
import { inviteReason } from '@/lib/invite-reason';

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<p>正在读取邀请…</p>}>
      <AcceptInvite />
    </Suspense>
  );
}

function AcceptInvite() {
  const token = useSearchParams().get('token') ?? '';
  const [result, setResult] = useState('');

  const send = async (path: 'accept' | 'decline') => {
    const response = await fetch(`/api/v1/team/invites/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const envelope = await response.json().catch(() => ({}));
    if (envelope?.success) {
      setResult(path === 'accept' ? '已加入工作区。' : '已拒绝邀请。');
      return;
    }
    setResult(inviteReason(envelope));
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-10 text-zinc-900">
      <h1 className="text-2xl font-bold">处理团队邀请</h1>
      <p className="mt-3 text-sm text-zinc-800">链接只能使用一次。过期、撤销或拒绝之后都不能再加入。</p>
      {!token && <p className="mt-4">缺少邀请链接。</p>}
      {token && (
        <div className="mt-6 flex gap-3">
          <Button type="primary" className="cn-cjk-pair" onClick={() => send('accept')}>接受</Button>
          <Button className="cn-cjk-pair" onClick={() => send('decline')}>拒绝</Button>
        </div>
      )}
      {result && <p className="mt-4">{result}</p>}
    </main>
  );
}
