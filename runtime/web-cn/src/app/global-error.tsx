'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="grid min-h-screen place-items-center bg-zinc-50 p-6 text-zinc-900">
        <main className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl">
          <p className="text-sm font-bold text-indigo-600">页面暂时无法显示</p>
          <h1 className="mt-3 text-3xl font-black">您的内容没有被发布。</h1>
          <p className="mt-4 leading-7 text-zinc-600">请重试；如果问题持续出现，请联系支持团队并提供错误编号。</p>
          {error.digest && <p className="mt-3 text-xs text-zinc-400">错误编号：{error.digest}</p>}
          <button onClick={reset} className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white">重新加载</button>
        </main>
      </body>
    </html>
  );
}
