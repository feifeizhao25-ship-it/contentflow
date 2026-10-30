/**
 * 语义级合规预检（离线、确定性）：先归一化（NFKC、去标点符号空白控制字符、常见繁体），再按词族匹配。
 * 与 ai/compliance/claims.ts 的字面库存互补，不替代它。
 */
const VARIANTS: Record<string, string> = { 穩: '稳', 賺: '赚', 報: '报', 險: '险', 確: '确', 診: '诊', 斷: '断', 療: '疗', 買: '买', 賣: '卖', 漲: '涨', 粉: '粉' };

export function normalize(text: string): string {
  const nfkc = (text ?? '').normalize('NFKC').toLowerCase();
  let out = '';
  for (const ch of nfkc) {
    if (/[\p{P}\p{Z}\p{S}\p{C}]/u.test(ch)) continue;
    out += VARIANTS[ch] ?? ch;
  }
  return out;
}

export const FAMILIES: Record<string, RegExp[]> = {
  investment_advice: [/(建议|推荐|强烈建议|务必|应该|可以)(你|您)?(立即|马上|现在)?(买入|卖出|加仓|减仓|清仓|满仓|抄底|重仓)/, /(立即|马上|赶紧)(买入|加仓|满仓|抄底|重仓)/, /(稳赚|包赚|必涨|必赚|翻倍|保本|保收益|零风险|无风险)/],
  return_promise: [/(年化|收益率?|回报率?|回报).{0,6}(保证|承诺|稳定在|不低于|可达到?)\d/, /(保证|确保|承诺).{0,4}(收益|回本|盈利|赚钱|回报)/],
  medical_claim: [/(治愈|根治|药到病除|包治|替代(药物|药品|医生|就医))/, /(诊断|确诊)(为|是|结果)/],
  absolute_claim: [/(百分之百|100|绝对|一定)(有效|安全|准确|不会出错|没有副作用|无副作用)/],
  // 分发侠特有：流量/排名承诺、刷量、去标识
  traffic_promise: [/(保证|确保|承诺|包).{0,6}(上热门|爆款|涨粉|排名|第一|上榜|10万|百万播放|流量)/, /(刷量|买粉|刷赞|刷评论|刷播放|刷单|控评)/],
  strip_ai_label: [/(ai|人工智能)(生成)?(标识|标签|水印|声明).{0,4}(去掉|去除|删掉|隐藏|不要|别加)/, /(去掉|去除|删掉|隐藏|绕过|规避|不要).{0,6}(ai|人工智能).{0,4}(标识|标签|水印|声明)/, /(去掉|去除|删除|抹掉).{0,4}(aigc|元数据)/],
  ad_law_superlative: [/(国家级|世界级|最高级|最佳|顶级|第一品牌|史上最)/],
  fake_authority: [/(官方认证|官方合作|平台官方推荐|平台内部渠道|内部消息)/],
};

export interface ComplianceResult {
  ok: boolean;
  hits: { family: string; matched: string }[];
  families: string[];
}

export function checkCompliance(text: string, families?: string[], extraLiterals: string[] = []): ComplianceResult {
  const norm = normalize(text);
  const hits: { family: string; matched: string }[] = [];
  for (const fam of families ?? Object.keys(FAMILIES)) {
    for (const re of FAMILIES[fam] ?? []) {
      const m = firstUnnegated(norm, re, fam);
      if (m) hits.push({ family: fam, matched: m });
    }
  }
  for (const lit of extraLiterals) {
    const n = normalize(lit);
    if (n && norm.includes(n)) hits.push({ family: 'literal', matched: lit });
  }
  return { ok: hits.length === 0, hits, families: Array.from(new Set(hits.map((h) => h.family))).sort() };
}

const NEGATORS = ['不', '无', '未', '没有', '勿', '别', '并非', '禁止', '不得', '严禁'];
/** 命中前紧邻否定词（如「不保证排名」）的不算违规；strip_ai_label 自带否定语义，不做豁免。 */
function firstUnnegated(norm: string, re: RegExp, family: string): string | null {
  const g = new RegExp(re.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = g.exec(norm))) {
    if (family === 'strip_ai_label') return m[0];
    const before = norm.slice(Math.max(0, m.index - 2), m.index);
    if (!NEGATORS.some((n) => before.endsWith(n))) return m[0];
    if (m[0].length === 0) g.lastIndex++;
  }
  return null;
}
