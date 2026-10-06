/**
 * AI 生成内容标识（AIGC labeling）— Web 端常量。
 *
 * 与 API 侧 `runtime/api/src/common/ai-content-label.ts` 保持一致：
 * 文本用显式标识，媒体文件在导出时写入隐式元数据标识。
 */

/** 文本显式标识 */
export const AI_TEXT_LABEL = '【本内容由 AI 生成】';

/** 生成方名称（写入媒体元数据） */
export const AI_GENERATOR_NAME = '分发侠';

/**
 * ffmpeg 导出 AI 生成视频时附加的隐式标识元数据参数。
 * 用法：outputOptions([...AI_MEDIA_METADATA_ARGS])
 */
export const AI_MEDIA_METADATA_ARGS: string[] = [
    '-metadata ai_generated=true',
    `-metadata generator=${AI_GENERATOR_NAME}`,
    '-metadata comment=AI-generated content',
];

/**
 * 给 AI 生成的文本加显式标识（与 API 侧 labelAiGeneratedText 一致）。
 * 幂等：已带标识的内容不会重复添加；空内容只返回标识本身。
 */
export function labelAiGeneratedText(content: string, label: string = AI_TEXT_LABEL): string {
    const body = (content || '').trim();
    if (body.startsWith(label)) return body;
    return body.length > 0 ? `${label}\n${body}` : label;
}

/** 内容是否来自 AI 生成：正文带显式标识，或生成流程里做过标记。 */
export function isAiGeneratedText(content: string, flaggedByFlow = false): boolean {
    return flaggedByFlow || (content || '').includes(AI_TEXT_LABEL);
}
