/**
 * AI 生成内容标识（AIGC labeling）统一工具。
 *
 * 依据《人工智能生成合成内容标识办法》的要求分两层：
 *  - 显式标识：文本内容附带用户可见的「AI 生成」提示；
 *  - 隐式标识：媒体文件元数据中写入 AI 生成标记。
 *
 * 生成/导出链路统一从这里取标识，避免各处自造文案不一致。
 */

/** 文本显式标识（前缀形式，便于导出内容一眼可辨） */
export const AI_TEXT_LABEL = '【本内容由 AI 生成】';

/** 隐式标识写入元数据时使用的生成方名称 */
export const AI_GENERATOR_NAME = 'ContentFlow (分发侠)';

/**
 * 给 AI 生成的文本加显式标识。幂等：已带标识的内容不会重复添加。
 */
export function labelAiGeneratedText(content: string, label: string = AI_TEXT_LABEL): string {
  const body = (content || '').trim();
  if (body.startsWith(label)) return body;
  return body.length > 0 ? `${label}\n${body}` : label;
}

export interface AiMediaMetadata {
  /** 隐式标识核心字段：标记该媒体为 AI 生成 */
  ai_generated: true;
  /** 生成方 */
  generator: string;
  /** 媒体类型：image / video / audio 等 */
  media_type: string;
  /** 生成时间（ISO 8601） */
  generated_at: string;
  /** 生成所用模型（可选，未知则不伪造） */
  model?: string;
}

/**
 * 构建媒体文件的 AI 生成隐式标识元数据，
 * 供导出图片/视频时写入文件元数据或随响应下发。
 */
export function buildAiMediaMetadata(opts: {
  mediaType: string;
  model?: string;
  generator?: string;
  now?: Date;
}): AiMediaMetadata {
  const meta: AiMediaMetadata = {
    ai_generated: true,
    generator: opts.generator || AI_GENERATOR_NAME,
    media_type: opts.mediaType,
    generated_at: (opts.now || new Date()).toISOString(),
  };
  if (opts.model) meta.model = opts.model;
  return meta;
}
