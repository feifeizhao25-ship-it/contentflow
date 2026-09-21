import { NextRequest, NextResponse } from 'next/server';
import { apiOrigin } from '../../../lib/api-proxy';

/**
 * AI 路由的共享工具。
 *
 * 为什么这批端点落在 Next 而不是 NestJS：
 *
 *   1. **响应形态不兼容。** NestJS 全局挂了 `TransformInterceptor`，把每个响应
 *      包成 `{ success, data, meta }`。而 TTS 返回音频二进制、视频生成返回 SSE 流，
 *      被包一层就直接损坏。
 *   2. **前端路径已经指在这里。** `/api/ai/*`、`/api/video/*` 不带 `v1`，
 *      本来就不走 `/api/v1/[...path]` 那个代理。
 *   3. **密钥只在服务端。** 这些变量没有 `NEXT_PUBLIC_` 前缀，
 *      只有 route handler 里读得到，客户端拿不到。
 *
 * 共同的红线：**供应商没配置就明确报错，绝不返回假数据。**
 * 之前这些路径整个不存在，前端拿到 404 后 catch 成一句「生成失败」，
 * 与「密钥没配」「余额不足」「服务宕机」完全无法区分。
 */

export class ProviderNotConfiguredError extends Error {
  constructor(
    public readonly provider: string,
    public readonly envVar: string,
  ) {
    super(`${provider} 未配置：请设置环境变量 ${envVar}`);
    this.name = 'ProviderNotConfiguredError';
  }
}

/** 取供应商密钥；未配置时抛出可被识别的错误，而不是拿空字符串去请求换一个 401。 */
export function requireKey(provider: string, envVar: string): string {
  const key = process.env[envVar];
  if (!key) {
    throw new ProviderNotConfiguredError(provider, envVar);
  }
  return key;
}

/**
 * 登录态。这些端点会消耗额度或读取外部资源，必须是有效的登录用户。
 *
 * 原来只看 ff_token cookie **在不在**：任何人带一个 `ff_token=x` 就算登录。
 * 现在拿它去后端 /auth/profile 验一次（验签 + 账号仍有效），不通过即 401。
 */
export async function requireAuth(request: NextRequest): Promise<string> {
  const token = request.cookies.get('ff_token')?.value;
  if (!token) throw new UnauthorizedError();
  let ok = false;
  try {
    const res = await fetch(`${apiOrigin()}/api/v1/auth/profile`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    ok = res.ok;
  } catch {
    throw new Error('登录状态校验服务暂不可用');
  }
  if (!ok) throw new UnauthorizedError();
  return token;
}

/**
 * 国内版未开通的能力（语音合成、自动字幕、视频生成）。
 *
 * 这些端点原来直连 OpenAI、Azure、ElevenLabs、fal.ai（均在境外）。国内版只接境内服务商，
 * 在接入境内供应商之前如实返回 501，不向境外发送任何数据、也不返回假结果。
 */
export function notAvailableInChina(feature: string): NextResponse {
  return NextResponse.json(
    {
      error: `${feature}在国内版暂未开通：需要接入境内服务商后提供`,
      code: 'NOT_AVAILABLE_IN_CN',
    },
    { status: 501 },
  );
}

export class UnauthorizedError extends Error {
  constructor() {
    super('未登录');
    this.name = 'UnauthorizedError';
  }
}

/** 把各类异常翻译成语义明确的 HTTP 响应。 */
export function toErrorResponse(e: unknown): NextResponse {
  if (e instanceof UnauthorizedError) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  if (e instanceof ProviderNotConfiguredError) {
    // 501 而非 500：这不是故障，是功能没开通。
    // 运维看到 500 会去查日志找 bug，看到 501 才知道该去配密钥。
    return NextResponse.json(
      {
        error: e.message,
        code: 'PROVIDER_NOT_CONFIGURED',
        provider: e.provider,
        required_env: e.envVar,
      },
      { status: 501 },
    );
  }
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message }, { status: 502 });
}

/** 上游返回非 2xx 时，把原始状态与响应体带出来，不要糊成一句「失败」。 */
export async function assertUpstreamOk(res: Response, provider: string): Promise<void> {
  if (res.ok) return;
  const detail = await res.text().catch(() => '');
  throw new Error(
    `${provider} 返回 ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
  );
}
