/**
 * 本地媒体文件路径白名单防护。
 *
 * 背景缺陷：video-merger-service 曾把以 `/` 开头的入参先拼到 public/ 下，
 * 找不到时**直接把原串当绝对路径复制文件** —— 传 `/etc/passwd` 就能把
 * 任意系统文件拷进 `public/generated/` 对外公开；`/../` 形式的相对穿越
 * 也没有拦截。本模块把「本地路径」严格约束在 public/ 根目录之内。
 */

import path from 'node:path';

/** 允许访问的根目录：Next.js 的 public/ */
export const PUBLIC_MEDIA_ROOT = path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'public');

export class MediaPathError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MediaPathError';
    }
}

/**
 * 把 `/generated/xxx.mp4` 形式的站内路径解析为 public/ 内的绝对路径。
 * 越界（`..` 穿越、URL 编码穿越、空字节注入）一律抛 MediaPathError。
 *
 * @throws MediaPathError
 */
export function resolvePublicMediaPath(urlPath: string): string {
    if (typeof urlPath !== 'string' || !urlPath.startsWith('/')) {
        throw new MediaPathError(`非法媒体路径（必须以 / 开头）: ${String(urlPath)}`);
    }

    // %2e%2e%2f 之类的编码穿越：先解码再校验
    let decoded: string;
    try {
        decoded = decodeURIComponent(urlPath);
    } catch {
        throw new MediaPathError(`媒体路径包含非法编码: ${urlPath}`);
    }

    if (decoded.includes('\0')) {
        throw new MediaPathError('媒体路径包含空字节');
    }

    // 拼到 public 根下再解析，最后确认没逃出根目录
    const resolved = path.resolve(PUBLIC_MEDIA_ROOT, `.${decoded}`);
    if (resolved !== PUBLIC_MEDIA_ROOT && !resolved.startsWith(PUBLIC_MEDIA_ROOT + path.sep)) {
        throw new MediaPathError(`媒体路径越出允许目录: ${urlPath}`);
    }
    return resolved;
}
