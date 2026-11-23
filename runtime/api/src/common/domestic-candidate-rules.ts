/**
 * 国内合规候选规则（待审核）。
 *
 * 这里的规则没有审核人，默认不参与合规检查。
 * 只有环境变量 COMPLIANCE_CANDIDATE_RULES=preview（或调用方显式传入 candidatePreview）时，
 * 命中项才作为「需复核」返回。其他取值（包括 true / 1 / on）一律不启用。
 * 审核人必须留空。不要在本文件写入任何人名。
 */
import type { DomesticComplianceHit, DomesticGateId } from './domestic-content-compliance';

export interface DomesticCandidateRule {
  ruleId: string;
  category: string;
  gate: DomesticGateId;
  review_status: '待审核';
  /** 留空。未经过具名审核，不得填审核人。 */
  reviewer: '';
  enabled: false;
  legalBasis: string;
  sourceUrl: string;
  sourceRetrievedAt: string;
  reason: string;
  match: (text: string) => string[];
}

const AD_LAW_URL = 'https://www.gov.cn/guoqing/2021-10/29/content_5647620.htm';
const FOOD_LAW_URL = 'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/fgs/art/2023/art_6bff4ef87291497fa72949e1fc88efb5.html';
const RETRIEVED = '2026-11-23';

const PENDING = '本条是待审核候选，审核人留空，不是法律意见，默认不启用。';

function uniqueTerms(parts: string[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    const term = part.replace(/\s+/g, '').slice(0, 40);
    if (term && !out.includes(term)) out.push(term);
  }
  return out;
}

function collect(text: string, pattern: RegExp): string[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return uniqueTerms([...text.matchAll(new RegExp(pattern.source, flags))].map((match) => match[0]));
}

/** 「第一天 / 第一步」不是排名承诺。只留下「长沙第一」这类排名说法。 */
function matchRankingFirst(text: string): string[] {
  const skipAfter = /^(?:天|步|次|集|期|周|页|行|章|节|课|眼|口|手|站|线|批|轮|波|稿|版|代|声|人称|现场|时间|季度|要务|责任|印象)/;
  const found: string[] = [];
  for (let index = text.indexOf('第一'); index >= 0; index = text.indexOf('第一', index + 2)) {
    if (skipAfter.test(text.slice(index + 2))) continue;
    const start = Math.max(0, index - 8);
    found.push(text.slice(start, index + 2));
  }
  return uniqueTerms(found);
}

function matchFoodDisease(text: string): string[] {
  return collect(text, /宝宝不生病|预防感冒|防感冒|预防疾病|不生病|不得病/g);
}

function matchHealthFunction(text: string): string[] {
  return uniqueTerms([
    ...collect(text, /增强免疫力|提高免疫力|提升免疫力/g),
    ...collect(text, /长高\s*(?:\d+(?:\.\d+)?|[一二两三四五六七八九十百]+)\s*(?:厘米|cm|公分)/gi),
    ...collect(text, /增高\s*(?:\d+(?:\.\d+)?|[一二两三四五六七八九十百]+)\s*(?:厘米|cm|公分)/gi),
  ]);
}

function matchNoSideEffect(text: string): string[] {
  return collect(text, /无任何副作用|没有副作用|零副作用|无副作用|一次就见效|一用就见效|一次见效|立马见效|立即见效/g);
}

function matchCureRate(text: string): string[] {
  return uniqueTerms([
    ...collect(text, /治愈率/g),
    ...collect(text, /有效率\s*(?:达|高达|为|超过|近)?\s*\d+(?:\.\d+)?\s*%?/g),
  ]);
}

function matchPatientTestimony(text: string): string[] {
  return collect(text, /患者证言|患者亲测|患者反馈|患者推荐|患者说|病友反馈|病友说|病人说/g);
}

function matchAbsoluteClaim(text: string): string[] {
  return uniqueTerms([
    ...matchRankingFirst(text),
    ...collect(text, /绝对正宗/g),
    ...collect(text, /包你满意|包您满意/g),
    ...collect(text, /100\s*%\s*好评|百分之百好评|百分百好评/g),
  ]);
}

export const DOMESTIC_CANDIDATE_RULES: readonly DomesticCandidateRule[] = [
  {
    ruleId: 'CN-CAND-FOOD-DISEASE',
    category: '食品预防疾病',
    gate: 'regulated_industry',
    review_status: '待审核',
    reviewer: '',
    enabled: false,
    legalBasis: `《中华人民共和国食品安全法》第七十一条（食品和食品添加剂的标签、说明书不得含有虚假内容，不得涉及疾病预防、治疗功能）、第七十三条（食品广告的内容应当真实合法，不得含有虚假内容，不得涉及疾病预防、治疗功能）。保健食品广告另见《中华人民共和国广告法》第十八条第一款第（二）项（不得涉及疾病预防、治疗功能）。食品安全法出处：${FOOD_LAW_URL} ；广告法出处：${AD_LAW_URL} 。两处均于 ${RETRIEVED} 对照公开文本核对。${PENDING}`,
    sourceUrl: FOOD_LAW_URL,
    sourceRetrievedAt: RETRIEVED,
    reason: '疑似把食品写成可以预防疾病',
    match: matchFoodDisease,
  },
  {
    ruleId: 'CN-CAND-HEALTH-FUNCTION',
    category: '保健功能宣称',
    gate: 'regulated_industry',
    review_status: '待审核',
    reviewer: '',
    enabled: false,
    legalBasis: `《中华人民共和国食品安全法》第七十五条（保健食品声称保健功能，应当具有科学依据；保健功能目录由国务院食品安全监督管理部门会同国务院卫生行政部门、国家中医药管理部门制定、调整并公布）、第七十八条（保健食品的标签、说明书不得涉及疾病预防、治疗功能，内容应当真实，与注册或者备案的内容相一致）。《中华人民共和国广告法》第十八条第一款第（一）项（保健食品广告不得含有表示功效、安全性的断言或者保证）。食品安全法出处：${FOOD_LAW_URL} ；广告法出处：${AD_LAW_URL} 。两处均于 ${RETRIEVED} 对照公开文本核对。普通食品使用这些词是否直接适用上述条款，须律师确认后才能启用。${PENDING}`,
    sourceUrl: FOOD_LAW_URL,
    sourceRetrievedAt: RETRIEVED,
    reason: '疑似宣称保健功能或量化增高效果',
    match: matchHealthFunction,
  },
  {
    ruleId: 'CN-CAND-NO-SIDE-EFFECT',
    category: '无副作用或一次见效',
    gate: 'advertising_law',
    review_status: '待审核',
    reviewer: '',
    enabled: false,
    legalBasis: `《中华人民共和国广告法》第十六条第一款第（一）项（医疗、药品、医疗器械广告不得含有表示功效、安全性的断言或者保证）、第十八条第一款第（一）项（保健食品广告不得含有表示功效、安全性的断言或者保证）。出处：${AD_LAW_URL} ，${RETRIEVED} 对照该页核对。上述条款是否及于页面中的每一句，须律师确认后才能启用。${PENDING}`,
    sourceUrl: AD_LAW_URL,
    sourceRetrievedAt: RETRIEVED,
    reason: '疑似对功效或安全性作出「无副作用」或「一次见效」的断言',
    match: matchNoSideEffect,
  },
  {
    ruleId: 'CN-CAND-CURE-RATE',
    category: '治愈率',
    gate: 'advertising_law',
    review_status: '待审核',
    reviewer: '',
    enabled: false,
    legalBasis: `《中华人民共和国广告法》第十六条第一款第（二）项（医疗、药品、医疗器械广告不得说明治愈率或者有效率）。出处：${AD_LAW_URL} ，${RETRIEVED} 对照该页核对。${PENDING}`,
    sourceUrl: AD_LAW_URL,
    sourceRetrievedAt: RETRIEVED,
    reason: '疑似说明治愈率或有效率',
    match: matchCureRate,
  },
  {
    ruleId: 'CN-CAND-PATIENT-TESTIMONY',
    category: '患者证言',
    gate: 'advertising_law',
    review_status: '待审核',
    reviewer: '',
    enabled: false,
    legalBasis: `《中华人民共和国广告法》第十六条第一款第（四）项（医疗、药品、医疗器械广告不得利用广告代言人作推荐、证明）、第十八条第一款第（五）项（保健食品广告不得利用广告代言人作推荐、证明）。出处：${AD_LAW_URL} ，${RETRIEVED} 对照该页核对。法条写的是广告代言人；患者或病友口述是否构成代言，须律师确认后才能启用。${PENDING}`,
    sourceUrl: AD_LAW_URL,
    sourceRetrievedAt: RETRIEVED,
    reason: '疑似以患者或病友名义作推荐、证明',
    match: matchPatientTestimony,
  },
  {
    ruleId: 'CN-CAND-ABSOLUTE-CLAIM',
    category: '绝对化用语或夸大承诺',
    gate: 'advertising_law',
    review_status: '待审核',
    reviewer: '',
    enabled: false,
    legalBasis: `《中华人民共和国广告法》第九条第（三）项列举不得使用“国家级”“最高级”“最佳”等用语；「第一」是否属于该条“等用语”，条文没有逐一列出，须律师确认，因此不作为已启用规则。《中华人民共和国广告法》第四条（广告不得含有虚假或者引人误解的内容，不得欺骗、误导消费者）；第十一条（广告使用数据、统计资料、调查结果等引证内容的，应当真实、准确，并表明出处）；第二十八条所列虚假广告情形第（二）项（商品的性能、功能、产地、质量、销售状况、曾获荣誉以及与商品或者服务有关的允诺等信息与实际情况不符，对购买行为有实质性影响的）和第（四）项（虚构使用商品或者接受服务的效果的）。出处：${AD_LAW_URL} ，${RETRIEVED} 对照该页核对。${PENDING}`,
    sourceUrl: AD_LAW_URL,
    sourceRetrievedAt: RETRIEVED,
    reason: '疑似使用绝对化用语或无法核对的夸大承诺',
    match: matchAbsoluteClaim,
  },
];

/** 仅接受精确的 preview。true / 1 / on 都不算已审核，不能启用。 */
export function candidateRulesPreviewEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.COMPLIANCE_CANDIDATE_RULES ?? '').trim().toLowerCase() === 'preview';
}

export function candidatePreviewRequested(
  options?: { candidatePreview?: boolean },
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (typeof options?.candidatePreview === 'boolean') return options.candidatePreview;
  return candidateRulesPreviewEnabled(env);
}

export function matchCandidateRuleHits(content: string): DomesticComplianceHit[] {
  const text = String(content || '').normalize('NFKC');
  const hits: DomesticComplianceHit[] = [];
  for (const rule of DOMESTIC_CANDIDATE_RULES) {
    const matchedTerms = rule.match(text);
    if (!matchedTerms.length) continue;
    hits.push({
      gate: rule.gate,
      ruleId: rule.ruleId,
      source: rule.legalBasis,
      sourceUrl: rule.sourceUrl,
      sourceRetrievedAt: rule.sourceRetrievedAt,
      reason: rule.reason,
      matchedTerms,
      severity: 'review',
      humanOverrideAllowed: true,
      label: '需复核',
    });
  }
  return hits;
}
