/**
 * 引用实体校验（Deceptive Grounding 的离线规则）。
 * 回答里出现的条文号、标准号、平台名，必须在被引原文里出现。
 * 不调用模型，也不改法律文本。
 */
const PLATFORMS = ['微信公众号', '哔哩哔哩', '小红书', '视频号', '公众号', '抖音', '快手', '知乎', '微博', 'B站'];

const RULE_PATTERNS = [/第[0-9一二三四五六七八九十百零〇]{1,6}条/g, /令第[0-9]{1,4}号/g];

/**
 * 句子用字。机关代字里常见的「国信办通字」「食品发」「广电」不在这里，
 * 避免把文号本身截断。
 */
const AGENCY_STOP = /[的了吗呢吧啊应当请要把被将和与或及并而但就不没未为是在有这那其会到着得说写明声主动核执用容产定知关印协删见句标已按从向给让使等过该须需能点本内要据根依户认]/;

/** 上一句没有标点、直接粘在文号前时，从左边剥掉这些句子词。 */
const LEADING_GLUE = /^(?:应当|应该|必须|需要|可以|不得|不能|不会|不要|根据|依据|声明|核对|执行|公布|主动|发布|关于|印发|以及|办法|用户|本产品|不代发|代发|请|把|将|对|和|与|或|及|而|但|就|的|了|在|为|是|见)/;

function stripLeadingGlue(prefix: string): string {
  let rest = prefix;
  for (let i = 0; i < 12 && rest.length > 2; i += 1) {
    const glue = rest.match(LEADING_GLUE);
    if (!glue) break;
    const next = rest.slice(glue[0].length);
    if (next.length < 2) break;
    rest = next;
  }
  return rest;
}

/** 文号只取〔年〕号前的机关代字。上一句没有标点粘在一起时，不把前半句吞进去。 */
function documentNumbers(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/〔[0-9]{4}〕[0-9]{1,4}号/g)) {
    const core = match[0];
    const start = match.index ?? 0;
    let left = start;
    while (left > 0 && /[\u4e00-\u9fffA-Za-z]/.test(text[left - 1]) && !AGENCY_STOP.test(text[left - 1]) && start - left < 12) left -= 1;
    out.push(`${stripLeadingGlue(text.slice(left, start))}${core}`);
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
