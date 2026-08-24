import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, toErrorResponse } from '../../_lib/provider';
import { buildAiImageLabel, labelImageBuffer } from '../../../../lib/ai-image-label';

export const runtime = 'nodejs';

/**
 * AI 生成图片的导出下载：取回图片字节、写入隐式 AI 标识元数据后以下载形式返回。
 *
 * 为什么放在这里而不是让浏览器直连 fal.ai / pollinations 下载：
 * 《人工智能生成合成内容标识办法》要求媒体文件带隐式标识，
 * 浏览器直接 <a href=外网URL> 下载拿不到写入元数据的机会。
 *
 * GET 而非 POST：浏览器下载就是 <a href>，不会带自定义请求头/请求体；
 * 登录态靠 ff_token cookie，与站内其他 AI 端点一致。
 */

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// 图片 URL 由客户端提供，必须同时满足「http(s) + 非内网 + 已知图片来源域」，
// 否则这个端点就是一个对内网的代理（SSRF 入口）
const ALLOWED_HOST_SUFFIXES = ['.fal.media', '.fal.run'];

function assertSafeImageUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('url 不是合法的 URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('url 只支持 http/https');
  }
  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||           // 云厂商元数据地址
    host === '[::1]';
  if (isPrivate) {
    throw new Error('url 不能指向内网地址');
  }
  const allowed =
    host === 'image.pollinations.ai' ||
    ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  if (!allowed) {
    throw new Error('url 不是受支持的 AI 图片来源域');
  }
  return url;
}

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    const raw = request.nextUrl.searchParams.get('url') || '';
    if (!raw) {
      return NextResponse.json({ error: 'url 不能为空' }, { status: 400 });
    }
    const safeUrl = assertSafeImageUrl(raw);

    const upstream = await fetch(safeUrl, { cache: 'no-store', redirect: 'error' });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `图片源返回 ${upstream.status}` },
        { status: 502 },
      );
    }

    const declared = Number(upstream.headers.get('content-length') ?? 0);
    if (declared > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: '图片超过 20MB 上限' }, { status: 400 });
    }
    const imageBuffer = Buffer.from(await upstream.arrayBuffer());
    // content-length 可能缺失或撒谎，实际读到之后再校一次
    if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: '图片超过 20MB 上限' }, { status: 400 });
    }

    const labeled = labelImageBuffer(imageBuffer, buildAiImageLabel());
    if (!labeled.labeled) {
      // 不支持的格式（如 webp）：宁可报错也不静默下发无隐式标识的文件
      return NextResponse.json(
        { error: '该图片格式暂不支持写入隐式标识（仅支持 PNG/JPEG）' },
        { status: 422 },
      );
    }

    const fallbackName = `ai-image-${Date.now()}.${labeled.format === 'png' ? 'png' : 'jpg'}`;
    const requestedName = (request.nextUrl.searchParams.get('filename') || fallbackName)
      .replace(/[^\w.一-龥-]+/g, '_')
      .slice(0, 120);
    const contentType =
      labeled.format === 'png' ? 'image/png' : 'image/jpeg';

    return new NextResponse(new Uint8Array(labeled.buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(requestedName)}`,
        // 显式再带一层机器可读的 AI 生成标记，与文本显式标识互补
        'X-AI-Generated': 'true',
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
