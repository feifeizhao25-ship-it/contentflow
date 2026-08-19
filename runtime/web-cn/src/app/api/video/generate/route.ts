import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, toErrorResponse } from '../../_lib/provider';

/**
 * 视频生成全流程（SSE 流式进度）。
 *
 * `src/hooks/useVideoGeneration.ts` 逐行读 `data: {...}`，字段约定：
 *   { step, stepId, progress, message }  推进某一步
 *   { done: true, url }                  完成
 *   { error }                            失败
 *
 * **stepId 必须与前端 `initSteps()` 的编号完全一致**，否则进度条永远不动 ——
 * 前端是按 `step-1 / step-2 / ...` 的顺序生成的，顺序是：
 *   准备 → [配音] → [字幕] → [音乐] → 每个片段 → 合成 → 完成
 * 方括号表示按参数条件出现。这里用同一套规则重算，两边不能各走各的。
 */

export const runtime = 'nodejs';
export const maxDuration = 900;

interface Segment {
  prompt: string;
  duration: number;
}

/** 与前端 initSteps 同规则地推导 stepId，避免两处编号错位 */
function planSteps(body: any): {
  prepare: string;
  voiceover?: string;
  subtitle?: string;
  music?: string;
  segments: string[];
  compose: string;
  finish: string;
} {
  let n = 0;
  const next = () => `step-${++n}`;

  const prepare = next();
  const voiceover = body?.voiceover ? next() : undefined;
  const subtitle = body?.subtitle?.enabled ? next() : undefined;
  const music = body?.music ? next() : undefined;
  const segments: string[] = (body?.segments ?? []).map(() => next());
  const compose = next();
  const finish = next();

  return { prepare, voiceover, subtitle, music, segments, compose, finish };
}

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);

    if (!process.env.FAL_API_KEY) {
      return NextResponse.json(
        {
          message: 'fal.ai 未配置：请设置环境变量 FAL_API_KEY',
          code: 'PROVIDER_NOT_CONFIGURED',
          required_env: 'FAL_API_KEY',
        },
        { status: 501 },
      );
    }

    const body = await request.json();
    const segments: Segment[] = Array.isArray(body?.segments) ? body.segments : [];
    if (segments.length === 0) {
      return NextResponse.json({ message: 'segments 不能为空' }, { status: 400 });
    }
    if (segments.length > 20) {
      return NextResponse.json({ message: '片段数量超过上限 20' }, { status: 400 });
    }

    const plan = planSteps(body);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          send({ step: 'running', stepId: plan.prepare, progress: 5, message: '正在准备…' });

          const { multiSegmentVideoService } = await import(
            '@/lib/multi-segment-video-service'
          );

          // 配音 / 字幕 / 音乐目前没有对应的生成实现。
          // 与其伪装成「已完成」，不如如实标注跳过 —— 否则用户会以为
          // 成片里有配音，拿到手才发现没有。
          if (plan.voiceover) {
            send({
              step: 'running', stepId: plan.voiceover, progress: 10,
              message: '配音需在编辑器中单独生成，本流程跳过',
            });
          }
          if (plan.subtitle) {
            send({
              step: 'running', stepId: plan.subtitle, progress: 12,
              message: '字幕需在编辑器中单独生成，本流程跳过',
            });
          }
          if (plan.music) {
            send({
              step: 'running', stepId: plan.music, progress: 14,
              message: '背景音乐暂未接入，本流程跳过',
            });
          }

          const urls: string[] = [];
          for (let i = 0; i < segments.length; i++) {
            const stepId = plan.segments[i];
            const base = 15 + Math.round((i / segments.length) * 65);
            send({
              step: 'running', stepId, progress: base,
              message: `生成片段 ${i + 1}/${segments.length}…`,
            });

            const url = await multiSegmentVideoService.generateExtendedVideo({
              prompt: String(segments[i]?.prompt ?? ''),
              style: body?.style ? String(body.style) : undefined,
              imageUrl: '',
              aspect_ratio: (body?.aspectRatio ?? '16:9') as '16:9' | '9:16' | '1:1',
              totalDuration: Math.min(Math.max(Number(segments[i]?.duration ?? 8), 4), 10),
            });

            if (!url) {
              throw new Error(`片段 ${i + 1} 未返回可用 URL`);
            }
            urls.push(url);
          }

          send({ step: 'running', stepId: plan.compose, progress: 85, message: '正在合成…' });

          let finalUrl = urls[0];
          if (urls.length > 1) {
            const { videoMerger } = await import('@/lib/video-merger-service');
            const merged = await videoMerger.mergeVideos({
              videoUrls: urls,
              aspectRatio: (body?.aspectRatio ?? '16:9') as '16:9' | '9:16' | '1:1',
              outputFormat: 'mp4',
            });
            if (merged.status !== 'completed' || !merged.url) {
              // 服务层有「失败退回第一段」的兜底，但那样用户会拿到一段短片
              // 却以为是完整成片 —— 这里明确报错。
              throw new Error('视频拼接未完成');
            }
            finalUrl = merged.url;
          }

          send({ step: 'running', stepId: plan.finish, progress: 100, message: '完成' });
          send({ done: true, url: finalUrl, segments: urls });
        } catch (e) {
          send({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        // 关掉 nginx 缓冲，否则进度会攒到最后一次性吐出来
        'x-accel-buffering': 'no',
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
