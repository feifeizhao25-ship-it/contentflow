/**
 * 规则包：AI 生成合成内容标识检查（发布前用）。
 *
 * 依据（只写条款里能查到的事实，不做解释性扩展）：
 * - 《人工智能生成合成内容标识办法》（国信办通字〔2025〕2号），2025-09-01 起施行：第三条（显式/隐式定义）、
 *   第四条（显式标识）、第五条（文件元数据隐式标识）。
 * - GB 45438—2025《网络安全技术 人工智能生成合成内容标识方法》，2025-09-01 起实施：第 5 章显式标识、
 *   第 6.1 条与附录 E 的元数据格式。
 *
 * 本模块是纯函数：不联网、不读文件、不改内容。它只回答「这条待发布内容缺不缺标识」，
 * 不替用户判断内容是否由 AI 生成——是否生成由调用方（用户声明或生成流水线记录）传入。
 */

export type AigcContentKind = 'text' | 'image' | 'audio' | 'video' | 'virtual_scene';

export type AigcIssueCode =
  | 'explicit_missing'
  | 'explicit_missing_ai_element'
  | 'explicit_missing_generation_element'
  | 'implicit_missing'
  | 'implicit_not_json'
  | 'implicit_missing_aigc_key'
  | 'implicit_label_invalid'
  | 'implicit_field_missing'
  | 'implicit_field_not_string';

export interface AigcIssue {
  code: AigcIssueCode;
  message: string;
  /** 条款出处，便于复核人对照原文。 */
  basis: string;
}

export interface AigcCheckResult {
  ok: boolean;
  issues: AigcIssue[];
}

const BASIS_EXPLICIT = '《人工智能生成合成内容标识办法》第四条；GB 45438—2025 第5章';
const BASIS_IMPLICIT = '《人工智能生成合成内容标识办法》第五条；GB 45438—2025 第6.1条、附录E';

/** 标识文字须同时含「人工智能要素」和「生成合成要素」（GB 45438—2025 5.1 b）。 */
const AI_ELEMENT = /人工智能|AI/i;
const GENERATION_ELEMENT = /生成|合成/;

/**
 * 显式标识文字检查。传入的是用户能看到的提示文字（文本首尾提示、画面角标文字、界面提示文字）。
 * 角标形式（GB 45438—2025 5.1 c）只要求含「AI」，所以 allowCornerMark=true 时只检查 AI 要素。
 */
export function checkExplicitLabel(labelText: string | null | undefined, options: { allowCornerMark?: boolean } = {}): AigcCheckResult {
  const text = (labelText ?? '').trim();
  const issues: AigcIssue[] = [];
  if (!text) {
    issues.push({ code: 'explicit_missing', message: '缺少用户可感知的 AI 生成合成提示。', basis: BASIS_EXPLICIT });
    return { ok: false, issues };
  }
  const cornerMark = options.allowCornerMark === true && /AI/i.test(text) && text.length <= 8;
  if (!AI_ELEMENT.test(text)) {
    issues.push({ code: 'explicit_missing_ai_element', message: '提示文字里没有「人工智能」或「AI」。', basis: BASIS_EXPLICIT });
  }
  if (!cornerMark && !GENERATION_ELEMENT.test(text)) {
    issues.push({ code: 'explicit_missing_generation_element', message: '提示文字里没有「生成」或「合成」。', basis: BASIS_EXPLICIT });
  }
  return { ok: issues.length === 0, issues };
}

export interface ImplicitCheckOptions {
  /** 内容传播服务提供者写入时，需要传播要素（ContentPropagator、PropagateID）。 */
  requirePropagation?: boolean;
}

const PRODUCTION_FIELDS = ['ContentProducer', 'ProduceID'] as const;
const PROPAGATION_FIELDS = ['ContentPropagator', 'PropagateID'] as const;
const OPTIONAL_STRING_FIELDS = ['ReservedCode1', 'ReservedCode2'] as const;

/**
 * 文件元数据隐式标识检查。输入是元数据里 AIGC 字段的 JSON 字符串，
 * 既可以是 {"AIGC":{...}}（附录 E 的整体格式），也可以是只含内层对象的字符串（OOXML/PDF 等写入方式，
 * 见 TC260 实践指南 6.1–6.3）。
 * Label 取值 "1"/"2"/"3"（属于/可能/疑似），类型必须是字符串。
 */
export function checkImplicitMetadata(raw: string | null | undefined, options: ImplicitCheckOptions = {}): AigcCheckResult {
  const issues: AigcIssue[] = [];
  const push = (code: AigcIssueCode, message: string) => issues.push({ code, message, basis: BASIS_IMPLICIT });
  if (!raw || !raw.trim()) {
    push('implicit_missing', '文件元数据里没有 AIGC 隐式标识。');
    return { ok: false, issues };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    push('implicit_not_json', 'AIGC 隐式标识不是合法 JSON 字符串。');
    return { ok: false, issues };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    push('implicit_not_json', 'AIGC 隐式标识不是对象。');
    return { ok: false, issues };
  }
  const outer = parsed as Record<string, unknown>;
  const inner = 'AIGC' in outer ? outer.AIGC : 'Label' in outer ? outer : undefined;
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) {
    push('implicit_missing_aigc_key', '缺少 AIGC 扩展字段。');
    return { ok: false, issues };
  }
  const fields = inner as Record<string, unknown>;
  if (typeof fields.Label !== 'string') {
    push('implicit_field_not_string', 'Label 必须是字符串。');
  } else if (!['1', '2', '3'].includes(fields.Label)) {
    push('implicit_label_invalid', 'Label 只能取 "1"（属于）、"2"（可能）、"3"（疑似）。');
  }
  const required = options.requirePropagation ? [...PRODUCTION_FIELDS, ...PROPAGATION_FIELDS] : [...PRODUCTION_FIELDS];
  for (const name of required) {
    const value = fields[name];
    if (value === undefined || value === null || value === '') {
      push('implicit_field_missing', `缺少 ${name}。`);
    } else if (typeof value !== 'string') {
      push('implicit_field_not_string', `${name} 必须是字符串。`);
    }
  }
  for (const name of [...OPTIONAL_STRING_FIELDS, ...(options.requirePropagation ? [] : PROPAGATION_FIELDS)]) {
    const value = fields[name];
    if (value !== undefined && typeof value !== 'string') push('implicit_field_not_string', `${name} 必须是字符串。`);
  }
  return { ok: issues.length === 0, issues };
}

export interface AigcPublishInput {
  kind: AigcContentKind;
  /** 调用方确认这条内容含 AI 生成合成成分（用户声明或流水线记录）。 */
  aiGenerated: boolean;
  explicitLabelText?: string | null;
  /** 文本/PDF 等文件通常能读到元数据；读不到时传 undefined，会被判为缺失。 */
  implicitMetadata?: string | null;
  requirePropagation?: boolean;
}

/**
 * 发布前「标识检查」步：非 AI 生成内容直接通过；
 * AI 生成内容需要显式标识文字和元数据隐式标识都满足。
 * 办法第九条允许在用户协议另行约定后提供不含显式标识的内容，那是服务提供者与用户之间的安排，
 * 发布到平台时仍应由用户主动声明（第十条），所以这里不放宽。
 */
export function checkAigcBeforePublish(input: AigcPublishInput): AigcCheckResult {
  if (!input.aiGenerated) return { ok: true, issues: [] };
  const explicit = checkExplicitLabel(input.explicitLabelText, { allowCornerMark: input.kind === 'text' || input.kind === 'image' });
  const implicit = checkImplicitMetadata(input.implicitMetadata, { requirePropagation: input.requirePropagation });
  const issues = [...explicit.issues, ...implicit.issues];
  return { ok: issues.length === 0, issues };
}
