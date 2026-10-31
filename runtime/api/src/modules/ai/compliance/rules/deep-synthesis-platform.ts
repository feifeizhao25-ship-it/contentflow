/**
 * 规则包：视频号深度合成内容发布前检查。
 *
 * 依据（只写原文里能查到的事实）：微信视频创作安全中心《视频号关于创作者规范使用深度合成技术生成内容的建议》
 * （https://mp.weixin.qq.com/s/qe6dUaATgrWkiggfXzcAYg，2026-10-31 已读原文）——
 * 1. 对生成或合成的非真实音视频内容进行显著标识；内容里出现虚拟人物形象的，虚拟人物技术使用者需进行实名验证；
 * 2. 不得侵犯其他用户或腾讯的合法权益，例如不得未经授权使用他人的肖像、声音（含面部、典型身体部位等）；
 * 3. 不得利用深度合成技术创作、发布谣言、虚假信息或具有煽动性的内容；
 * 4. 不得利用深度合成技术实施诈骗。
 *
 * 只对视频号（platform = 'weixin'）生效。其他平台的同类细则本版未收录（未取得 A 级来源），所以返回 applicable=false，
 * 不替它们下结论。纯函数：不联网、不读文件。
 */
export type DeepSynthesisIssueCode = 'virtual_person_realname_missing' | 'likeness_unauthorized' | 'explicit_label_missing' | 'rumor_or_fraud_declared';

export interface DeepSynthesisIssue {
  code: DeepSynthesisIssueCode;
  message: string;
  basis: string;
}

export interface DeepSynthesisInput {
  platform: string;
  /** 调用方确认内容含深度合成成分。 */
  deepSynthesized: boolean;
  hasVirtualPerson?: boolean;
  /** 虚拟人物技术使用者是否已在平台完成实名验证（用户声明）。 */
  realNameVerified?: boolean;
  usesOthersLikenessOrVoice?: boolean;
  likenessAuthorized?: boolean;
  explicitLabelText?: string | null;
  /** 用户声明内容是否含谣言/虚假信息/诈骗（命中即拒）。 */
  declaredRumorOrFraud?: boolean;
}

export interface DeepSynthesisResult {
  applicable: boolean;
  ok: boolean;
  issues: DeepSynthesisIssue[];
}

const BASIS = '《视频号关于创作者规范使用深度合成技术生成内容的建议》（微信视频创作安全中心）';

export function checkDeepSynthesisPublish(input: DeepSynthesisInput): DeepSynthesisResult {
  if (input.platform !== 'weixin') return { applicable: false, ok: true, issues: [] };
  if (!input.deepSynthesized) return { applicable: true, ok: true, issues: [] };
  const issues: DeepSynthesisIssue[] = [];
  const push = (code: DeepSynthesisIssueCode, message: string) => issues.push({ code, message, basis: BASIS });
  if (!(input.explicitLabelText ?? '').trim()) push('explicit_label_missing', '生成或合成的非真实音视频内容须显著标识。');
  if (input.hasVirtualPerson && input.realNameVerified !== true) push('virtual_person_realname_missing', '内容含虚拟人物形象，虚拟人物技术使用者须在平台完成实名验证。');
  if (input.usesOthersLikenessOrVoice && input.likenessAuthorized !== true) push('likeness_unauthorized', '不得未经授权使用他人的肖像、声音。');
  if (input.declaredRumorOrFraud) push('rumor_or_fraud_declared', '不得利用深度合成技术创作、发布谣言、虚假信息或实施诈骗。');
  return { applicable: true, ok: issues.length === 0, issues };
}
