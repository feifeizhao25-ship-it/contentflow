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
  // English preambles and sign-offs (international edition)
  /^(here (are|is)|sure|certainly|of course|absolutely|these (are|headlines|titles)|i hope|hope (this|these)|feel free|let me know|note\b)/i,
];

/** 标题的合理长度上限（提示词要求 20 字以内，留出余量） */
const MAX_TITLE_LENGTH = 50;
/** English headlines run longer than Chinese ones; the international prompt asks for under 80 characters. */
const MAX_TITLE_LENGTH_LATIN = 90;

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

/**
 * 一行原始输出 -> 干净标题：先剥 markdown 标题记号（"### 1. 标题"）、再剥序号/项目符号、再剥强调与引号，
 * 序号被加粗包住（"**1. 标题**"）时去掉强调后再剥一次序号。
 * 真实缺陷（2026-11-05 Next.js web-cn 复测）：模型返回 "### 1. 标题"，旧逻辑不认 "#"，页面「标题推荐」和发布草案标题里带着 "### 1."。
 */
function cleanTitleLine(rawLine: string): string {
  let s = rawLine.replace(/^\s*#{1,6}\s+/, '');
  // "**4. 标题**"：序号被加粗包住，先把开头的强调记号拿掉，序号才认得出来
  s = s.replace(/^\s*(?:\*\*|__)(\s*\d{1,2}\s*[.、)）:：])/, '$1');
  return stripMarkup(stripListMarker(s));
}

function isMetaLine(line: string): boolean {
  if (line.length === 0) return true;
  if (/[:：]\s*$/.test(line)) return true; // 以冒号结尾的多半是小标题/引导语
  return META_LINE_PATTERNS.some((p) => p.test(line));
}

/**
 * 「6个小红书爆款标题」这类包装行不是标题。
 * 「10个技巧」不含「爆款标题」，保留。
 */
const TITLE_PACKAGING = /^(?:\d{1,2}|[一二两三四五六七八九十])\s*个.{0,30}爆款标题/;

export function isTitlePackagingLine(line: string): boolean {
  return TITLE_PACKAGING.test(String(line || '').normalize('NFKC').trim());
}

const CN_TITLE_COUNT: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

const TITLE_COUNT_IN_TOPIC = /(\d{1,2}|[一二两三四五六七八九十])\s*个\s*(?:(?:小红书|抖音|快手|视频号|微博|哔哩哔哩|b站|爆款)\s*){0,3}标题/;

/**
 * 主题里写了「5个标题」或「5个小红书标题」时按这个数生成。
 * 只接受 1–10（与标题数量接口上限一致）。没写、或写出范围时，沿用调用方传入的数量。
 */
export function resolveRequestedTitleCount(topic: string, requested: number): number {
  const fallback = Number.isInteger(requested) && requested >= 1 && requested <= 10 ? requested : 5;
  const matched = String(topic || '').normalize('NFKC').match(TITLE_COUNT_IN_TOPIC);
  if (!matched) return fallback;
  const raw = matched[1];
  const count = CN_TITLE_COUNT[raw] ?? Number(raw);
  if (!Number.isInteger(count) || count < 1 || count > 10) return fallback;
  return count;
}

/**
 * 把模型原始输出解析为干净标题数组。
 * @throws Error 当解析后没有任何有效标题时
 */
export function parseGeneratedTitles(raw: string, count: number): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];

  for (const rawLine of (raw || '').split(/\r?\n/)) {
    const stripped = cleanTitleLine(rawLine);
    if (isMetaLine(stripped) || isTitlePackagingLine(stripped)) continue;
    if (stripped.length > (/[\u3400-\u9fff]/.test(stripped) ? MAX_TITLE_LENGTH : MAX_TITLE_LENGTH_LATIN)) continue;
    if (seen.has(stripped)) continue;
    seen.add(stripped);
    titles.push(stripped);
    if (titles.length >= count) break;
  }

  if (titles.length === 0) {
    throw new Error(process.env.MARKET_REGION === 'global'
      ? 'The AI headline result failed validation: no usable headline was found'
      : 'AI 标题生成结果未通过结构化校验：未解析到任何有效标题');
  }
  return titles;
}
