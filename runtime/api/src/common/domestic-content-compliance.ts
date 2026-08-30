export const DOMESTIC_RULESET_VERSION = 'cn-content-2026.08.30';

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
  humanOverrideAllowed: boolean;
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
    gate: 'advertising_law', ruleId: 'CN-AD-001',
    source: '《中华人民共和国广告法》第九条、第二十八条',
    sourceUrl: 'https://sjfg.samr.gov.cn/law/file/pdf/3235243/1663323599406.pdf',
    sourceRetrievedAt: '2026-08-30',
    reason: '疑似包含绝对化、保证性或结果承诺表述',
    terms: ['国家级', '最高级', '最佳', '第一品牌', '百分之百', '100%有效', '包过', '稳赚', '绝对有效'],
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

export function evaluateDomesticContent(content: string): DomesticComplianceResult {
  const normalized = String(content || '').normalize('NFKC').toLowerCase();
  const hits = RULES.flatMap((rule) => {
    const matchedTerms = rule.terms.filter((term) => normalized.includes(term.toLowerCase()));
    return matchedTerms.length ? [{
      gate: rule.gate,
      ruleId: rule.ruleId,
      source: rule.source,
      sourceUrl: rule.sourceUrl,
      sourceRetrievedAt: rule.sourceRetrievedAt,
      reason: rule.reason,
      matchedTerms,
      humanOverrideAllowed: rule.humanOverrideAllowed,
    }] : [];
  });
  return { passed: hits.length === 0, ruleSetVersion: DOMESTIC_RULESET_VERSION, hits };
}

export const DOMESTIC_GATE_ORDER: readonly DomesticGateId[] = [
  'illegal_content', 'advertising_law', 'regulated_industry',
  'minor_protection', 'misinformation', 'intellectual_property',
] as const;
