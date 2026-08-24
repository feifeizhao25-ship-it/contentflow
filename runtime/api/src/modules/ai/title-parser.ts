/**
 * AI 标题生成结果的结构化解析与校验。
 *
 * 背景缺陷：模型常在正式标题前后输出说明性文字，例如
 * 「以下是为您生成的10个标题：」「希望这些标题对您有帮助！」。
 * 旧实现只做 `split('\n')` + 去序号，把这些说明文字当成标题返回，
 * 最终可能出现在发布内容里。
 *
 * 本模块把解析收敛为「剥离前后缀 → 过滤说明行 → 校验」三步，
 * 拿不到任何有效标题时抛错（fail closed），由上层转成生成失败，
 * 而不是把脏数据带给用户。
 */

/** 说明性/寒暄性行的特征：出现在开头即视为非标题行 */
const META_LINE_PATTERNS: RegExp[] = [
  /^(以下是|下面|下面为|这是|这是我|根据|好的|当然|没问题|以上|综上)/,
  /^(希望|如果|如需|需要|欢迎|请告诉|您可以|你可以)/,
  /^(注|备注|说明|提示|温馨提示)\s*[:：]/,
  /^(标题|headlines?|titles?)\s*[:：]?\s*$/i,
  /^[-—=*>#\s]{2,}$/, // 分隔线 / 装饰行
];

/** 标题的合理长度上限（提示词要求 20 字以内，留出余量） */
const MAX_TITLE_LENGTH = 50;

/** 去掉行首的序号、项目符号和「标题N：」式前缀 */
function stripListMarker(line: string): string {
  return line
    .replace(/^\s*(?:[-*•·▪◦]|\d{1,2}\s*[.、)）:：])\s*/, '')
    .replace(/^标题\s*\d{0,2}\s*[:：]\s*/, '')
    .trim();
}

/** 去掉 markdown 强调和成对引号/书名号 */
function stripMarkup(line: string): string {
  let out = line.replace(/\*\*/g, '').replace(/__/g, '').trim();
  // 反复剥落成对的包围符号（「」""''《》等）
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = out
      .replace(/^[「『《"“'‘]+/, '')
      .replace(/[」』》"”'’]+$/, '')
      .trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

function isMetaLine(line: string): boolean {
  if (line.length === 0) return true;
  if (/[:：]\s*$/.test(line)) return true; // 以冒号结尾的多半是小标题/引导语
  return META_LINE_PATTERNS.some((p) => p.test(line));
}

/**
 * 把模型原始输出解析为干净标题数组。
 * @throws Error 当解析后没有任何有效标题时
 */
export function parseGeneratedTitles(raw: string, count: number): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];

  for (const rawLine of (raw || '').split(/\r?\n/)) {
    const stripped = stripMarkup(stripListMarker(rawLine));
    if (isMetaLine(stripped)) continue;
    if (stripped.length > MAX_TITLE_LENGTH) continue;
    if (seen.has(stripped)) continue;
    seen.add(stripped);
    titles.push(stripped);
    if (titles.length >= count) break;
  }

  if (titles.length === 0) {
    throw new Error('AI 标题生成结果未通过结构化校验：未解析到任何有效标题');
  }
  return titles;
}
