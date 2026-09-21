import { NextRequest, NextResponse } from 'next/server';
import { apiOrigin, buildUpstreamHeaders } from '../../../../lib/api-proxy';

/**
 * 短视频分镜脚本：转给后端 POST /api/v1/ai/generate/script。
 *
 * 原来在这里直连境外的模型聚合路由。后端按市场选择境内供应商，计入租户 AI 预算与
 * 生成记录，并随结果返回 AIGC 显式标识。前端期待的 `{ title, scenes[] }` 形状不变。
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  if (!request.cookies.get('ff_token')?.value) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${apiOrigin()}/api/v1/ai/generate/script`, {
      method: 'POST',
      headers: buildUpstreamHeaders(request),
      body: await request.text(),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: '脚本生成服务暂不可用，请稍后重试' }, { status: 502 });
  }
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const message = Array.isArray(payload?.message) ? payload.message[0] : payload?.message;
    return NextResponse.json(
      { error: typeof message === 'string' && message ? message : '脚本生成失败，请稍后重试' },
      { status: upstream.status },
    );
  }
  return NextResponse.json(payload?.data ?? payload);
}
