import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, toErrorResponse } from '../../_lib/provider';

export const runtime = 'nodejs';

/**
 * 多分镜合成必须由持久化 Worker 完成。
 * Web 生产容器只读且可水平扩容，不能返回仅存在于当前实例的本地文件。
 */
export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const body = await request.json();
    const urls = Array.isArray(body?.videoUrls)
      ? body.videoUrls.map((url: unknown) => String(url ?? '').trim()).filter(Boolean)
      : [];

    if (urls.length === 0) {
      return NextResponse.json({ error: 'videoUrls 必须是非空数组' }, { status: 400 });
    }
    if (urls.length === 1) {
      return NextResponse.json({ url: urls[0], merged: false });
    }

    return NextResponse.json(
      {
        error: '多分镜合成服务尚未配置，未生成残缺或临时成片',
        code: 'PROVIDER_NOT_CONFIGURED',
        dependency_code: 'VIDEO_WORKER_NOT_CONFIGURED',
        failure_code: 'MERGE_FAILED',
        required: ['VIDEO_WORKER_URL', 'OBJECT_STORAGE_BUCKET'],
      },
      { status: 501 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
