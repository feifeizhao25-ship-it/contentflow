/**
 * 把 checkExplicitLabel 接到国内发布包、复制导出和分发前检查。
 * 只判断用户能看到的文字里有没有显式标识。不联网，不调用平台，不改既有六道闸。
 */
import { checkExplicitLabel, type AigcIssue } from './aigc-label';

export const DOMESTIC_EXPLICIT_LABEL_CODE = 'AIGC_EXPLICIT_LABEL_REQUIRED';

export interface DomesticExplicitLabelBlock {
  code: typeof DOMESTIC_EXPLICIT_LABEL_CODE;
  message: string;
  issues: AigcIssue[];
}

/** 非 AI 内容直接通过。AI 内容缺少办法第四条 / GB 45438 要求的显式要素时返回中文拦截说明。 */
export function domesticExplicitLabelBlock(text: string | null | undefined, aiGenerated: boolean): DomesticExplicitLabelBlock | null {
  if (!aiGenerated) return null;
  const result = checkExplicitLabel(text);
  if (result.ok) return null;
  return {
    code: DOMESTIC_EXPLICIT_LABEL_CODE,
    message: `发布或导出前缺少可感知的 AI 显式标识：${result.issues.map((issue) => issue.message).join('')}请在用户能看到的文字里同时保留「人工智能」或「AI」，以及「生成」或「合成」。本次没有向平台提交。这不是法律意见。`,
    issues: result.issues,
  };
}
