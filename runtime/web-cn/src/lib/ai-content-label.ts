/**
 * AI 生成内容标识（AIGC labeling）— Web 端常量。
 *
 * 与 API 侧 `runtime/api/src/common/ai-content-label.ts` 保持一致：
 * 文本用显式标识，媒体文件在导出时写入隐式元数据标识。
 */

/** 文本显式标识 */
export const AI_TEXT_LABEL = '【本内容由 AI 生成】';

/** 生成方名称（写入媒体元数据） */
export const AI_GENERATOR_NAME = 'ContentFlow (分发侠)';

/**
 * ffmpeg 导出 AI 生成视频时附加的隐式标识元数据参数。
 * 用法：outputOptions([...AI_MEDIA_METADATA_ARGS])
 */
export const AI_MEDIA_METADATA_ARGS: string[] = [
    '-metadata ai_generated=true',
    `-metadata generator=${AI_GENERATOR_NAME}`,
    '-metadata comment=AI-generated content',
];
