import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, toErrorResponse } from '../../_lib/provider';

/**
 * 单个分镜的视频生成。
 *
 * 服务层已经存在（`src/lib/multi-segment-video-service.ts`，封装 fal veo3.1），
 * 缺的只是把它暴露成 HTTP 端点 —— 前端一直在打 `/api/ai/generate-video`，
 * 而这个路由从来没有建过，请求全部 404。
 *
 * 前端读 `data.video?.url || data.url`，两种都兼容。
 */

export const runtime = 'nodejs';
// 视频生成是分钟级的，默认函数超时远远不够
export const maxDuration = 600;

const ASPECT_RATIOS = new Set(['16:9', '9:16', '1:1']);

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);

    if (!process.env.FAL_API_KEY) {
      // 501 而非 500：功能没开通，不是坏了
      return NextResponse.json(
        {
          error: 'fal.ai 未配置：请设置环境变量 FAL_API_KEY',
          code: 'PROVIDER_NOT_CONFIGURED',
          provider: 'fal.ai',
          required_env: 'FAL_API_KEY',
        },
        { status: 501 },
      );
    }

    const body = await request.json();
    const prompt = String(body?.prompt ?? '').trim();
    if (!prompt) {
      return NextResponse.json({ error: 'prompt 不能为空' }, { status: 400 });
    }

    const aspectRatio = String(body?.aspect_ratio ?? '16:9');
    if (!ASPECT_RATIOS.has(aspectRatio)) {
      return NextResponse.json(
        { error: `aspect_ratio 只支持 ${[...ASPECT_RATIOS].join(' / ')}` },
        { status: 400 },
      );
    }

    const { multiSegmentVideoService } = await import(
      '@/lib/multi-segment-video-service'
    );

    const videoUrl = await multiSegmentVideoService.generateExtendedVideo({
      prompt,
      style: body?.style ? String(body.style) : undefined,
      imageUrl: body?.imageUrl ? String(body.imageUrl) : '',
      aspect_ratio: aspectRatio as '16:9' | '9:16' | '1:1',
      totalDuration: Math.min(Math.max(Number(body?.duration ?? 8), 4), 10),
    });

    if (!videoUrl) {
      // 服务层理论上会抛，这里兜一道 —— 绝不返回空 URL 让前端以为成功
      return NextResponse.json(
        { error: '视频生成未返回可用 URL', code: 'NO_VIDEO_URL' },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: videoUrl, video: { url: videoUrl } });
  } catch (e) {
    return toErrorResponse(e);
  }
}
