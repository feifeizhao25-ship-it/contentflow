/**
 * 引用实体校验（Deceptive Grounding 的离线规则）。
 * 回答里出现的条文号、标准号、平台名，必须在被引原文里出现。
 * 不调用模型，也不改法律文本。
 */
const PLATFORMS = ['微信公众号', '哔哩哔哩', '小红书', '视频号', '公众号', '抖音', '快手', '知乎', '微博', 'B站'];

const RULE_PATTERNS = [/第[0-9一二三四五六七八九十百零〇]{1,6}条/g, /令第[0-9]{1,4}号/g];

/** 文号取括号前、标点之后的机关名，避免把句子前半段吞进去。 */
function documentNumbers(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/〔[0-9]{4}〕[0-9]{1,4}号/g)) {
    const core = match[0];
    const start = match.index ?? 0;
    let left = start;
    while (left > 0 && /[\u4e00-\u9fffA-Za-z]/.test(text[left - 1]) && start - left < 12) left -= 1;
    out.push(`${text.slice(left, start)}${core}`);
  }
  return out;
}

const STANDARD_PATTERN = /GB\s*(?:\/\s*[TZ])?\s*[0-9]{3,6}\s*-\s*[0-9]{4}/gi;

export interface CitationEntityCheck {
  ok: boolean;
  missing: string[];
  checked: string[];
}

function compact(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, '');
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = compact(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.replace(/\s+/g, ''));
  }
  return out;
}

export function extractCitationEntities(answer: string): string[] {
  const text = answer ?? '';
  const found: string[] = [];
  for (const pattern of RULE_PATTERNS) {
    pattern.lastIndex = 0;
    found.push(...(text.match(pattern) ?? []));
  }
  STANDARD_PATTERN.lastIndex = 0;
  found.push(...(text.match(STANDARD_PATTERN) ?? []));
  found.push(...documentNumbers(text));
  let rest = text;
  for (const name of PLATFORMS) {
    if (rest.includes(name)) {
      found.push(name);
      rest = rest.split(name).join(' ');
    }
  }
  return unique(found);
}

/** 文号、标准号或平台名不在被引片段中时，citation 失败。 */
export function checkCitationEntities(answer: string, citedTexts: string[]): CitationEntityCheck {
  const checked = extractCitationEntities(answer);
  const corpus = compact(citedTexts.join('\n'));
  const missing = checked.filter((entity) => !corpus.includes(compact(entity)));
  return { ok: missing.length === 0, missing, checked };
}
