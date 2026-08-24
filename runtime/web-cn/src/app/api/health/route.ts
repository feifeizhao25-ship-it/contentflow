import { NextResponse } from 'next/server';

/**
 * 连通性探针。
 *
 * 为什么需要它：`components/error/ErrorBoundary.tsx` 用
 * `fetch('/api/health', { method: 'HEAD' })` 的耗时判断网络快慢，
 * 失败就 `setIsSlowNetwork(true)`。而此前 web-cn 里根本没有这个路由 ——
 * 请求恒定 404、恒定走 catch，**每个用户都被永久标记成慢网络**，
 * 相关降级 UI 对所有人常驻。
 *
 * 后端的 health 被 `setGlobalPrefix('api/v1', { exclude: ['health'] })` 排除，
 * 挂在 `/health` 而不是 `/api/v1/health`，因此 Next 的 `/api/v1/[...path]`
 * 代理够不到它，只能单独开一个。
 *
 * HEAD 只判活；GET 额外回报上游状态，便于排查是前端还是 API 挂了。
 */

const apiOrigin = process.env.API_INTERNAL_URL || 'http://api:4000';
const UPSTREAM_TIMEOUT_MS = 3000;

async function pingUpstream(): Promise<{ ok: boolean; status: number | null; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    const res = await fetch(`${apiOrigin}/health`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function HEAD() {
  // 探针本身不应因上游故障而失败 —— 它测的是「前端可达性 + 往返延迟」。
  // 上游状态由 GET 给出，避免把 API 故障误判成网络慢。
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  const upstream = await pingUpstream();
  return NextResponse.json(
    {
      status: 'ok',
      service: 'fenfa-web-cn',
      upstream: {
        reachable: upstream.ok,
        status: upstream.status,
        ...(upstream.error ? { error: upstream.error } : {}),
      },
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
