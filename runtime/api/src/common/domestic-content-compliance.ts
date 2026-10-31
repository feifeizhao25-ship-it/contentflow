export const DOMESTIC_RULESET_VERSION = 'cn-content-2026.10.31';

/** 每次检查都带上。关键词命中不是律师意见，也不是“通过即可发布”。 */
export const COMPLIANCE_DISCLAIMER = '这不是法律意见。未发现风险不等于可以发布，发布前请自行核对。';

export type DomesticGateId =
  | 'illegal_content'
  | 'advertising_law'
  | 'regulated_industry'
  | 'minor_protection'
  | 'misinformation'
  | 'intellectual_property';

/** block：法条原文或既有硬性规则，生成和发布都拦住。review：可能有风险，生成仍可用，保守模式下发布前须人工确认。 */
export type ComplianceSeverity = 'block' | 'review';
export type ComplianceLevel = 'violation' | 'risk' | 'clear';

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
  severity: ComplianceSeverity;
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
  /** 没有 block 级命中。review 级不把生成停掉。 */
  passed: boolean;
  /** violation：有明确拦截；risk：只有“可能有风险”；clear：这批规则未发现。 */
  level: ComplianceLevel;
  disclaimer: string;
  /** 资料过期时调用方传入。本身不改变 passed，发布侧用它要求人工确认。 */
  mode: 'normal' | 'conservative';
  ruleSetVersion: string;
  hits: DomesticComplianceHit[];
  /** 命中数（block 拦截 / review 提示）。 */
  hitCounts: { block: number; review: number; total: number };
  /** 本次一共跑了多少条规则。「clear」只和这个数一样可靠。 */
  rulesChecked: number;
  /** 这套筛查判断不了的事。展示给用户，避免把「未发现」读成「已审核通过」。 */
  notChecked: string[];
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
    source: '《互联网广告管理办法》（国家市场监督管理总局令第72号）第八条（广告应当具有可识别性）、第九条第三款（种草/测评等附购买方式应当显著标明“广告”）',
    sourceUrl: 'https://www.gov.cn/zhengce/202305/content_6858084.htm',
    sourceRetrievedAt: '2026-10-16',
    reason: '以种草/测评/体验分享形式推销并附购买方式，但未显著标明“广告”',
    matchedTerms: [...forms],
    severity: 'block',
    humanOverrideAllowed: true,
  } as DomesticComplianceHit;
}

const HEALTH_CLAIM = /(?:吃了|喝了|用了|敷了|贴了)[^。\n]{0,16}(?:血压|血糖|血脂|肿瘤|癌症|糖尿病|高血压)[^。\n]{0,8}(?:稳|降|好|消失|正常)|(?:治好|治愈|治疗好|根治)了?[^。\n]{0,16}(?:病|症|炎|癌|痛|溃疡|结石|糖尿病|高血压)|降血压|降血糖|降血脂|抗癌|防癌|调理三高/;

/** 《广告法》第十七条、第十八条里写明的疾病治疗/预防功能。只做关键词筛查，不代表律师已抽样验收。 */
function checkHealthClaim(content: string): DomesticComplianceHit | null {
  const text = String(content || '').normalize('NFKC');
  const matched = text.match(HEALTH_CLAIM);
  if (!matched) return null;
  return {
    gate: 'regulated_industry',
    ruleId: 'CN-AD-ART17-18',
    source: '《中华人民共和国广告法》第十七条（非医疗广告不得涉及疾病治疗功能）、第十八条（保健食品广告不得涉及疾病预防、治疗功能）',
    sourceUrl: 'https://sjfg.samr.gov.cn/law/file/pdf/3235243/1663323599406.pdf',
    sourceRetrievedAt: '2026-08-30',
    reason: '疑似把商品写成具有疾病治疗或预防功能',
    matchedTerms: [matched[0].slice(0, 40)],
    severity: 'block',
    humanOverrideAllowed: true,
  };
}

const ART25_TERMS = ['保本', '无风险', '保收益'] as const;
const ART25_YIELD = /年化[^。\n]{0,16}(?:稳赚|保证|保本|无风险|保收益)/;
/** 「必涨」「闭眼买入」「没有任何风险」是对投资结果的保证性断言，与「保本、无风险」同属第二十五条禁止的承诺。 */
const ART25_CERTAINTY = /必涨|必赚|一定(?:会)?涨|闭眼(?:买|入|冲)|稳赚不赔|(?:没有|毫无|零|无)任何风险|绝对安全/;

/** 第二十五条原文写了保本、无风险、保收益。年化搭配保证性用语一并拦截。稳赚仍走原有风险词，不改挂法条。 */
function checkInvestmentGuarantee(content: string): DomesticComplianceHit | null {
  const text = String(content || '').normalize('NFKC');
  const terms = ART25_TERMS.filter((term) => text.includes(term));
  const yieldHit = text.match(ART25_YIELD);
  const certainty = text.match(ART25_CERTAINTY);
  const matchedTerms = [...terms, ...(yieldHit ? [yieldHit[0].slice(0, 40)] : []), ...(certainty ? [certainty[0]] : [])];
  if (!matchedTerms.length) return null;
  return {
    gate: 'advertising_law',
    ruleId: 'CN-AD-ART25',
    source: '《中华人民共和国广告法》第二十五条（不得对投资回报作保证性承诺，不得明示或者暗示保本、无风险或者保收益）',
    sourceUrl: 'https://sjfg.samr.gov.cn/law/file/pdf/3235243/1663323599406.pdf',
    sourceRetrievedAt: '2026-08-30',
    reason: '疑似对收益作保证性承诺',
    matchedTerms,
    severity: 'block',
    humanOverrideAllowed: true,
  };
}

function reviewHit(content: string, terms: readonly string[], hit: Omit<DomesticComplianceHit, 'matchedTerms' | 'severity'>): DomesticComplianceHit | null {
  const text = String(content || '').normalize('NFKC').toLowerCase();
  const matchedTerms = terms.filter((term) => text.includes(term.toLowerCase()));
  if (!matchedTerms.length) return null;
  return { ...hit, matchedTerms, severity: 'review' };
}

/** 平台站外导流、借灾难营销、保证涨粉：没有经人工复核的平台原文，只标“可能有风险”，不在普通模式下停生成。 */
function checkReviewOnly(content: string): DomesticComplianceHit[] {
  const hits = [
    reviewHit(content, ['加微信', '加v', '私信领取', '站外下单', '微信领资料'], {
      gate: 'misinformation',
      ruleId: 'CN-PLATFORM-OFFSITE',
      source: '常见短视频与社区规范禁止站外导流（平台原文尚未人工复核，不能当成已审核条款）',
      sourceUrl: 'https://www.douyin.com',
      sourceRetrievedAt: '2026-08-23',
      reason: '疑似引导到站外联系或交易，发布前请对照目标平台现行规范',
      humanOverrideAllowed: true,
    }),
    reviewHit(content, ['最好吃', '最好用', '全国最好', '全网第一', '全国第一', '世界第一', '行业第一', '销量第一', '史上最'], {
      gate: 'advertising_law',
      ruleId: 'CN-AD-SUPERLATIVE',
      source: '《中华人民共和国广告法》第九条第（三）项“等用语”（条文只列举「国家级」「最高级」「最佳」；此处的「最好」「第一」类比较性用语是否属于，待广告合规律师审核，所以只提示风险、不直接拦截）',
      sourceUrl: 'https://sjfg.samr.gov.cn/law/file/pdf/3235243/1663323599406.pdf',
      sourceRetrievedAt: '2026-10-31',
      reason: '疑似使用「最好」「第一」类绝对化比较用语，需要有可核验的依据，发布前请核对',
      humanOverrideAllowed: true,
    }),
    reviewHit(content, ['趁灾', '借地震', '借疫情带货', '灾难营销', '蹭灾难'], {
      gate: 'misinformation',
      ruleId: 'CN-ECO-DISASTER',
      source: '《网络信息内容生态治理规定》第七条（不得借自然灾害、事故灾难等制作、发布不良信息）',
      sourceUrl: 'https://www.cac.gov.cn',
      sourceRetrievedAt: '2026-08-30',
      reason: '疑似借灾难、事故带货或博流量',
      humanOverrideAllowed: true,
    }),
    reviewHit(content, ['保证涨粉', '保证爆款', '平台内部渠道'], {
      gate: 'advertising_law',
      ruleId: 'CN-PROMO-RESULT',
      source: '产品合规口径：宣传不承诺涨粉、保证爆款或平台内部渠道（未写成法条硬性条款）',
      sourceUrl: 'https://www.cac.gov.cn',
      sourceRetrievedAt: '2026-10-23',
      reason: '疑似承诺涨粉、爆款或内部渠道',
      humanOverrideAllowed: true,
    }),
  ];
  return hits.filter((hit): hit is DomesticComplianceHit => !!hit);
}

/** 词表规则之外还有 3 个专项检查（广告标注、疾病功效、投资保证）和 4 个提示类检查（站外导流、绝对化比较、借灾难、保证涨粉）。 */
export const DOMESTIC_EXTRA_CHECKS = 7;

export const DOMESTIC_NOT_CHECKED: readonly string[] = [
  '各平台（抖音、小红书、快手、视频号等）现行社区规范原文——尚未逐条人工复核',
  '图片、视频、音频、字幕里的内容（这里只检查文字）',
  '医疗、金融、教育等行业需要的资质与专项审批',
  '著作权、商标、肖像权',
  '你写的数据和功效有没有证据支持',
];

export function countHits(hits: ReadonlyArray<{ severity: 'block' | 'review' }>) {
  const block = hits.filter((h) => h.severity === 'block').length;
  const review = hits.filter((h) => h.severity === 'review').length;
  return { block, review, total: hits.length };
}

export function evaluateDomesticContent(content: string, options?: { conservative?: boolean }): DomesticComplianceResult {
  const normalized = String(content || '').normalize('NFKC').toLowerCase();
  const hits: DomesticComplianceHit[] = RULES.flatMap((rule) => {
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
      severity: 'block' as const,
      humanOverrideAllowed: rule.humanOverrideAllowed,
    }] : [];
  });
  const extras = [checkAdDisclosure(content), checkHealthClaim(content), checkInvestmentGuarantee(content), ...checkReviewOnly(content)];
  const order = (gate: DomesticGateId) => DOMESTIC_GATE_ORDER_INTERNAL.indexOf(gate);
  for (const extra of extras) {
    if (!extra) continue;
    const at = hits.findIndex((hit) => order(hit.gate) > order(extra.gate));
    hits.splice(at === -1 ? hits.length : at, 0, extra);
  }
  const blocked = hits.some((hit) => hit.severity === 'block');
  const review = hits.some((hit) => hit.severity === 'review');
  return {
    passed: !blocked,
    level: blocked ? 'violation' : review ? 'risk' : 'clear',
    disclaimer: COMPLIANCE_DISCLAIMER,
    mode: options?.conservative ? 'conservative' : 'normal',
    ruleSetVersion: DOMESTIC_RULESET_VERSION,
    hits,
    hitCounts: countHits(hits),
    rulesChecked: RULES.length + DOMESTIC_EXTRA_CHECKS,
    notChecked: [...DOMESTIC_NOT_CHECKED],
  };
}

const DOMESTIC_GATE_ORDER_INTERNAL: readonly DomesticGateId[] = [
  'illegal_content', 'advertising_law', 'regulated_industry',
  'minor_protection', 'misinformation', 'intellectual_property',
];

export const DOMESTIC_GATE_ORDER: readonly DomesticGateId[] = [
  'illegal_content', 'advertising_law', 'regulated_industry',
  'minor_protection', 'misinformation', 'intellectual_property',
] as const;
