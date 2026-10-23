export const DOMESTIC_RULESET_VERSION = 'cn-content-2026.10.16';

export type DomesticGateId =
  | 'illegal_content'
  | 'advertising_law'
  | 'regulated_industry'
  | 'minor_protection'
  | 'misinformation'
  | 'intellectual_property';

export interface DomesticComplianceHit {
  gate: DomesticGateId;
  ruleId: string;
  source: string;
  sourceUrl: string;
  sourceRetrievedAt: string;
  reason: string;
  matchedTerms: string[];
  /** 结构化词表命中时，每个词对应的法条出处 */
  matchedDetails?: Array<{ term: string; legalBasis: string }>;
  humanOverrideAllowed: boolean;
}

/**
 * 《中华人民共和国广告法》第九条第（三）项明确列举的绝对化用语：「国家级」「最高级」「最佳」。
 *
 * 只收录法条原文明确列举的三个用语，不自行扩充「等用语」的范围（扩充须由广告合规律师审核后
 * 另立条目并写明依据）。variants 只收字形变体（繁体）；空格、间隔号等插字写法由匹配时的归一化处理。
 */
export interface StructuredTerm {
  term: string;
  variants: readonly string[];
  legalBasis: string;
}

export const AD_LAW_ART9_LEGAL_BASIS = '《中华人民共和国广告法》第九条第（三）项';

export const AD_LAW_ART9_TERMS: readonly StructuredTerm[] = [
  { term: '国家级', variants: ['國家級'], legalBasis: AD_LAW_ART9_LEGAL_BASIS },
  { term: '最高级', variants: ['最高級'], legalBasis: AD_LAW_ART9_LEGAL_BASIS },
  { term: '最佳', variants: [], legalBasis: AD_LAW_ART9_LEGAL_BASIS },
] as const;

/**
 * 白名单语境：整个短语出现时，其中的用语不按广告绝对化用语处理。
 * 只放明显不是对商品或服务作比较性宣传的通用术语；新增条目须写明理由并经合规复核。
 */
export const AD_TERM_WHITELIST_CONTEXTS: ReadonlyArray<{ phrase: string; covers: string; reason: string }> = [
  { phrase: '最佳实践', covers: '最佳', reason: '管理与技术领域的通用术语（best practice），不是对商品或服务的比较性宣传' },
];

/** 匹配前的归一化：全角转半角、小写、去掉字与字之间的空白与间隔符（「最 佳」「最·佳」）。 */
function normalizeForTerms(content: string): string {
  return String(content || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u00b7\u2022\u30fb\u200b_*~-]+/g, '');
}

function matchStructuredTerms(content: string, terms: readonly StructuredTerm[]) {
  let text = normalizeForTerms(content);
  for (const context of AD_TERM_WHITELIST_CONTEXTS) {
    text = text.split(normalizeForTerms(context.phrase)).join('〇');
  }
  return terms
    .filter((entry) => [entry.term, ...entry.variants].some((form) => text.includes(normalizeForTerms(form))))
    .map((entry) => ({ term: entry.term, legalBasis: entry.legalBasis }));
}

export interface DomesticComplianceResult {
  passed: boolean;
  ruleSetVersion: string;
  hits: DomesticComplianceHit[];
}

interface GateRule {
  gate: DomesticGateId;
  ruleId: string;
  source: string;
  sourceUrl: string;
  sourceRetrievedAt: string;
  reason: string;
  terms: readonly string[];
  /** 结构化词表（带法条出处、变体与白名单语境）；有它时 terms 留空 */
  structuredTerms?: readonly StructuredTerm[];
  humanOverrideAllowed: boolean;
}

// 顺序即产品文稿规定的六道闸顺序。规则必须带来源和版本，禁止无来源词表静默上线。
const RULES: readonly GateRule[] = [
  {
    gate: 'illegal_content', ruleId: 'CN-ILLEGAL-001',
    source: '《互联网信息服务管理办法》（2024年第二次修订）及目标平台现行违法违规内容规范',
    sourceUrl: 'https://xzfg.moj.gov.cn/front/law/detail?LawID=1756',
    sourceRetrievedAt: '2026-08-30',
    reason: '疑似包含违法活动招揽或交易表述', terms: ['博彩', '赌博', '刷单', '代开发票', '买卖账号'],
    humanOverrideAllowed: false,
  },
  {
    gate: 'advertising_law', ruleId: 'CN-AD-ART9-3',
    source: AD_LAW_ART9_LEGAL_BASIS,
    sourceUrl: 'https://sjfg.samr.gov.cn/law/file/pdf/3235243/1663323599406.pdf',
    sourceRetrievedAt: '2026-08-30',
    reason: '包含《广告法》第九条明确列举的绝对化用语',
    terms: [],
    structuredTerms: AD_LAW_ART9_TERMS,
    humanOverrideAllowed: true,
  },
  {
    // 原来与上面的词一起标为「第九条、第二十八条」，但这些词并非法条明确列举；
    // 不再挂具体法条，如实标为需律师审核的风险表述，继续拦截以免放松。
    gate: 'advertising_law', ruleId: 'CN-AD-RISK-001',
    source: '常见保证性、结果承诺与比较性表述（未对应具体法条，待广告合规律师审核）',
    sourceUrl: 'https://sjfg.samr.gov.cn/law/file/pdf/3235243/1663323599406.pdf',
    sourceRetrievedAt: '2026-08-30',
    reason: '疑似包含保证性或结果承诺表述',
    terms: ['第一品牌', '百分之百', '100%有效', '包过', '稳赚', '绝对有效'],
    humanOverrideAllowed: true,
  },
  {
    gate: 'regulated_industry', ruleId: 'CN-INDUSTRY-001',
    source: '《广告法》及医疗、药品、金融、教育培训等行业广告和经营资质要求',
    sourceUrl: 'https://sjfg.samr.gov.cn/law/file/pdf/3235243/1663323599406.pdf',
    sourceRetrievedAt: '2026-08-30',
    reason: '疑似包含需要专项资质与证据复核的行业承诺',
    terms: ['治愈', '根治', '保本保收益', '保收益', '包就业', '包拿证'],
    humanOverrideAllowed: true,
  },
  {
    gate: 'minor_protection', ruleId: 'CN-MINOR-001',
    source: '《中华人民共和国未成年人保护法》《未成年人网络保护条例》',
    sourceUrl: 'https://xzfg.moj.gov.cn/front/law/detail?LawID=1694',
    sourceRetrievedAt: '2026-08-30',
    reason: '疑似诱导未成年人消费、规避监护或参与高风险行为',
    terms: ['瞒着家长充值', '未成年借款', '学生贷款秒批', '儿童博彩'],
    humanOverrideAllowed: true,
  },
  {
    gate: 'misinformation', ruleId: 'CN-TRUTH-001',
    source: '《互联网信息服务管理办法》（2024年第二次修订）及各目标平台现行社区规范',
    sourceUrl: 'https://xzfg.moj.gov.cn/front/law/detail?LawID=1756',
    sourceRetrievedAt: '2026-08-30',
    reason: '疑似以无法核验的权威背书制造事实性结论',
    terms: ['内部消息百分百准确', '官方指定但不公开', '零风险保证', '已获官方认证无需核验'],
    humanOverrideAllowed: true,
  },
  {
    gate: 'intellectual_property', ruleId: 'CN-IP-001',
    source: '《中华人民共和国著作权法》《中华人民共和国商标法》《中华人民共和国民法典》人格权编',
    sourceUrl: 'https://www.npc.gov.cn/c2/c30834/202011/t20201119_308796.html',
    sourceRetrievedAt: '2026-08-30',
    reason: '疑似要求未经授权使用作品、商标、肖像或搬运内容',
    terms: ['未经授权搬运', '去水印直接用', '冒用商标', '盗用肖像', '复制他人付费课程'],
    humanOverrideAllowed: true,
  },
] as const;

// 《互联网广告管理办法》（市场监管总局令第72号）第九条第三款：知识介绍、体验分享、消费测评等形式
// 推销商品或服务并附加购物链接等购买方式的，应当显著标明“广告”。这是“缺少标注”类检查，不是禁用词。
const AD_DISCLOSURE_FORMS = ['种草', '测评', '评测', '好物推荐', '好物分享', '体验分享', '开箱', '安利'] as const;
const PURCHASE_SIGNALS = [/https?:\/\//i, /购物链接|购买链接|下单链接|商品链接|小黄车|橱窗|点击购买|戳链接|链接在评论区|淘口令|优惠券/,
  /taobao|tmall|jd\.com|pinduoduo|yangkeduo|e\.tb\.cn|u\.jd\.com/i] as const;

export function checkAdDisclosure(content: string): DomesticComplianceHit | null {
  const text = String(content || '').normalize('NFKC');
  const forms = AD_DISCLOSURE_FORMS.filter((form) => text.includes(form));
  if (!forms.length) return null;
  if (!PURCHASE_SIGNALS.some((re) => re.test(text))) return null;
  if (/广告/.test(text)) return null;
  return {
    gate: 'advertising_law',
    ruleId: 'CN-AD-NET-ART9-3',
    source: '《互联网广告管理办法》（国家市场监督管理总局令第72号）第九条第三款',
    sourceUrl: 'https://www.gov.cn/zhengce/202305/content_6858084.htm',
    sourceRetrievedAt: '2026-10-16',
    reason: '以种草/测评/体验分享形式推销并附购买方式，但未显著标明“广告”',
    matchedTerms: [...forms],
    humanOverrideAllowed: true,
  } as DomesticComplianceHit;
}

export function evaluateDomesticContent(content: string): DomesticComplianceResult {
  const normalized = String(content || '').normalize('NFKC').toLowerCase();
  const hits = RULES.flatMap((rule) => {
    const details = rule.structuredTerms ? matchStructuredTerms(content, rule.structuredTerms) : [];
    const matchedTerms = rule.structuredTerms
      ? details.map((detail) => detail.term)
      : rule.terms.filter((term) => normalized.includes(term.toLowerCase()));
    return matchedTerms.length ? [{
      gate: rule.gate,
      ruleId: rule.ruleId,
      source: rule.source,
      sourceUrl: rule.sourceUrl,
      sourceRetrievedAt: rule.sourceRetrievedAt,
      reason: rule.reason,
      matchedTerms,
      ...(rule.structuredTerms ? { matchedDetails: details } : {}),
      humanOverrideAllowed: rule.humanOverrideAllowed,
    }] : [];
  });
  const disclosure = checkAdDisclosure(content);
  if (disclosure) {
    const order = (gate: DomesticGateId) => DOMESTIC_GATE_ORDER_INTERNAL.indexOf(gate);
    const at = hits.findIndex((hit) => order(hit.gate) > order('advertising_law'));
    hits.splice(at === -1 ? hits.length : at, 0, disclosure as (typeof hits)[number]);
  }
  return { passed: hits.length === 0, ruleSetVersion: DOMESTIC_RULESET_VERSION, hits };
}

const DOMESTIC_GATE_ORDER_INTERNAL: readonly DomesticGateId[] = [
  'illegal_content', 'advertising_law', 'regulated_industry',
  'minor_protection', 'misinformation', 'intellectual_property',
];

export const DOMESTIC_GATE_ORDER: readonly DomesticGateId[] = [
  'illegal_content', 'advertising_law', 'regulated_industry',
  'minor_protection', 'misinformation', 'intellectual_property',
] as const;
