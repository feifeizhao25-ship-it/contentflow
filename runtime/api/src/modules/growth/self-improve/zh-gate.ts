/**
 * 运行时「只输出中文」检查（国内版）：回答里不得出现未释义的英文单词。
 * 规则沿用 zh-ui 门禁：专业缩写可用（白名单），其余英文词不得出现在正文里。
 * 这是检查器，用于评测门禁（zh_only_rate 指标）；不改写任何回答。
 */
export const DEFAULT_ZH_ALLOW: ReadonlySet<string> = new Set([
  'ai', 'aigc', 'app', 'kw', 'kwh', 'mw', 'mwh', 'gw', 'gwh', 'tw', 'twh', 'kv', 'v', 'a', 'hz',
  'gb', 'mb', 'kb', 'pv', 'cny', 'rmb', 'pdf', 'url', 'api', 'id', 'qr', 'sku', 'ip', 'tcm', 'ccer', 'ev', 'bms', 'ems', 'gps', 'wecom', 'co2', 'co', 'no', 'so', 'pm',
]);

export function englishWords(text: string, allow: ReadonlySet<string> = DEFAULT_ZH_ALLOW): string[] {
  const cleaned = String(text ?? '').replace(/https?:\/\/\S+|\S+@\S+\.\S+/g, ' ');
  return (cleaned.match(/[A-Za-z][A-Za-z\-']+/g) ?? []).filter((w) => !allow.has(w.toLowerCase()));
}
export const zhOnlyOk = (text: string, allow: ReadonlySet<string> = DEFAULT_ZH_ALLOW): boolean => englishWords(text, allow).length === 0;
/** 评测集上「回答不含未释义英文」的比例。空集返回 0（fail-closed）。 */
export function zhOnlyRate(answers: string[], allow: ReadonlySet<string> = DEFAULT_ZH_ALLOW): number {
  return answers.length ? answers.filter((a) => zhOnlyOk(a, allow)).length / answers.length : 0;
}
