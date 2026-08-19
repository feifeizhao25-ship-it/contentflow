import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, toErrorResponse } from '../../_lib/provider';

/**
 * 多个分镜视频拼接成片。
 *
 * 服务层已存在（`src/lib/video-merger-service.ts`），缺的是 HTTP 端点。
 * 前端 `video-studio/page.tsx` 读 `mergeData.url`。
 */

export const runtime = 'nodejs';
export const maxDuration = 600;

const ASPECT_RATIOS = new Set(['16:9', '9:16', '1:1']);
const MAX_SEGMENTS = 20;

/**
 * 拼接靠的是**系统里的 ffmpeg 二进制**，不是 npm 包 —— `fluent-ffmpeg`
 * 只是个调用壳子。镜像里没装 ffmpeg 时，错误会从 ffmpeg 内部以
 * `Cannot find ffmpeg` 之类的形式冒出来，混在一堆流处理堆栈里很难认。
 * 这里提前探一次，把「环境没装」和「拼接失败」分开。
 */
async function assertFfmpegAvailable(): Promise<void> {
  const ffmpeg = (await import('fluent-ffmpeg')).default;
  await new Promise<void>((resolve, reject) => {
    ffmpeg.getAvailableFormats((err: unknown) => {
      if (err) {
        reject(
          new FfmpegUnavailableError(
            err instanceof Error ? err.message : String(err),
          ),
        );
      } else {
        resolve();
      }
    });
  });
}

class FfmpegUnavailableError extends Error {
  constructor(detail: string) {
    super(`ffmpeg 不可用：${detail}`);
    this.name = 'FfmpegUnavailableError';
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);

    const body = await request.json();
    const videoUrls: unknown = body?.videoUrls;

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json(
        { error: 'videoUrls 必须是非空数组' },
        { status: 400 },
      );
    }
    if (videoUrls.length > MAX_SEGMENTS) {
      return NextResponse.json(
        { error: `分镜数量超过上限 ${MAX_SEGMENTS}` },
        { status: 400 },
      );
    }

    // 上游生成失败时前端可能把 undefined 混进来，先拦掉
    const urls = videoUrls.map((u) => String(u ?? '')).filter(Boolean);
    if (urls.length !== videoUrls.length) {
      return NextResponse.json(
        { error: 'videoUrls 中存在空值，说明有分镜未生成成功' },
        { status: 400 },
      );
    }

    const aspectRatio = String(body?.aspectRatio ?? '16:9');
    if (!ASPECT_RATIOS.has(aspectRatio)) {
      return NextResponse.json(
        { error: `aspectRatio 只支持 ${[...ASPECT_RATIOS].join(' / ')}` },
        { status: 400 },
      );
    }

    // 只有一段就不必走拼接
    if (urls.length === 1) {
      return NextResponse.json({ url: urls[0], merged: false });
    }

    try {
      await assertFfmpegAvailable();
    } catch (e) {
      if (e instanceof FfmpegUnavailableError) {
        // 501 而非 500：这是部署环境缺组件，不是代码缺陷
        return NextResponse.json(
          {
            error: e.message,
            code: 'PROVIDER_NOT_CONFIGURED',
            provider: 'ffmpeg',
            hint: '镜像中需安装 ffmpeg（Dockerfile: apk add ffmpeg / apt-get install ffmpeg）',
          },
          { status: 501 },
        );
      }
      throw e;
    }

    const { videoMerger } = await import('@/lib/video-merger-service');
    const result = await videoMerger.mergeVideos({
      videoUrls: urls,
      aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1',
      outputFormat: 'mp4',
    });

    if (result.status !== 'completed' || !result.url) {
      // 注意：服务层内部有「拼接失败就退回第一段」的兜底，
      // 那对**自动流程**尚可接受，但对用户主动点击的成片操作不行 ——
      // 拿到一段 5 秒视频却以为是完整成片，比报错更糟。
      return NextResponse.json(
        {
          error: '视频拼接未完成',
          code: 'MERGE_FAILED',
          status: result.status,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: result.url, merged: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
