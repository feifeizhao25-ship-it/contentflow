/**
 * 人工确认发布（小红书 / 视频号 / 公众号）的前端辅助。
 *
 * 这三个平台不做自动发布：用户「复制文案」「下载带 AI 标识的封面」后自己到平台发出，
 * 再点「我已手动发布」，可回填作品链接。只保存链接，不去平台抓任何数据。
 */
import { AI_TEXT_LABEL, labelAiGeneratedText } from './ai-content-label';
import { buildAiImageLabel, labelImageDataUrl } from './ai-image-label-browser';

export const MANUAL_PLATFORMS = [
    { id: 'xhs', name: '小红书', icon: '📕' },
    { id: 'weixin', name: '视频号', icon: '💬' },
    { id: 'wechat_mp', name: '公众号', icon: '📰' },
] as const;

export const AUTO_PLATFORMS = ['douyin', 'bilibili'] as const;

export const PUBLISH_CHANNEL_NOTICE =
    '抖音、B 站需完成开放平台授权后自动发布；小红书、视频号、公众号暂不支持自动发布，可一键复制文案并下载带 AI 标识的封面后手动发布';

export function isManualPlatform(id: string): boolean {
    return MANUAL_PLATFORMS.some((p) => p.id === id);
}

export function manualPlatformName(id: string): string {
    return MANUAL_PLATFORMS.find((p) => p.id === id)?.name ?? '其他平台';
}

export interface ManualKit {
    platform: string;
    platformName: string;
    guide: string;
    title: string;
    body: string;
    coverUrl: string | null;
    aiGenerated: boolean;
}

/** 复制到剪贴板的文案：标题 + 正文；AI 生成的内容保证带「AI 生成」显式标识（不能删、不能弱化）。 */
export function buildCopyText(kit: Pick<ManualKit, 'title' | 'body' | 'aiGenerated'>): string {
    const body = kit.aiGenerated ? labelAiGeneratedText(kit.body || '') : (kit.body || '');
    const title = (kit.title || '').trim();
    return title ? `${title}\n\n${body}` : body;
}

export function copyTextHasAiLabel(text: string): boolean {
    return text.includes(AI_TEXT_LABEL);
}

/** 封面上显式标识的文字与位置（左上角，半透明黑底白字，按图片宽度缩放）。 */
export const COVER_LABEL_TEXT = 'AI 生成';

/**
 * 下载带 AI 标识的封面（浏览器内完成）：
 *  1. 经本站 /api/ai/export-image 取回图片（同源，画布不会被污染；服务端已写入隐式标识）；
 *  2. 在画布左上角画上显式标识「AI 生成」；
 *  3. 导出 PNG 时再写入隐式标识（iTXt），然后触发下载。
 */
export async function downloadLabelledCover(coverUrl: string, filename: string): Promise<void> {
    const res = await fetch(`/api/ai/export-image?url=${encodeURIComponent(coverUrl)}`, { credentials: 'include' });
    if (!res.ok) throw new Error('封面下载失败，请稍后重试');
    const bitmap = await createImageBitmap(await res.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器不支持导出图片');
    ctx.drawImage(bitmap, 0, 0);
    const fontSize = Math.max(18, Math.round(canvas.width / 24));
    ctx.font = `bold ${fontSize}px sans-serif`;
    const padding = Math.round(fontSize * 0.5);
    const textWidth = ctx.measureText(COVER_LABEL_TEXT).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(padding, padding, textWidth + padding * 2, fontSize + padding * 1.2);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(COVER_LABEL_TEXT, padding * 2, padding * 1.6);
    const dataUrl = labelImageDataUrl(canvas.toDataURL('image/png'), buildAiImageLabel());
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}
