/**
 * 国内版生成前筛查：用户要的是什么，在占额度、调用模型之前看。
 * 只拦「去做刷单 / 虚假好评 / 虚构证言」的请求。讲解、识别、劝阻不拦。
 * 生成结果仍走 evaluateDomesticContent，这里不改那套输出规则。
 */
export const DOMESTIC_REQUEST_RULESET_VERSION = 'cn-request-2026.11.15';

const SOURCE = '《网络交易监督管理办法》（2021年3月15日国家市场监督管理总局令第37号公布）第十四条第二款第（一）项：不得虚构交易、编造用户评价';
const SOURCE_URL = 'https://www.gov.cn/zhengce/2021-03/15/content_5723683.htm';
const SOURCE_RETRIEVED_AT = '2026-11-15';

export interface DomesticRequestHit {
  ruleId: string;
  severity: 'block';
  reason: string;
  source: string;
  sourceUrl: string;
  sourceRetrievedAt: string;
  matchedTerms: string[];
  humanOverrideAllowed: false;
}

export interface DomesticRequestResult {
  blocked: boolean;
  ruleSetVersion: string;
  hits: DomesticRequestHit[];
}

interface RequestRule {
  ruleId: string;
  reason: string;
  /** 明确是在索要或实施，句子里同时出现「不要 / 违法」也拦。 */
  intent: readonly RegExp[];
  /** 出现这些词就拦，除非整段是在识别、讲解或劝阻。 */
  keywords: readonly RegExp[];
}

const RULES: readonly RequestRule[] = [
  {
    ruleId: 'CN-REQ-SHUADAN',
    reason: '该请求是在索要刷单、虚构交易或刷销量，不能代为生成。',
    intent: [
      /(?:帮|替)我(?:写|做|搞|生成)?刷(?:单|销量|好评|评价)/,
      /(?:怎么|如何|怎样)刷(?:单|销量|好评|评价)/,
      /刷(?:单|销量|好评|评价)(?:文案|话术|脚本|教程|攻略)/,
    ],
    keywords: [/刷单/, /刷销量/, /刷好评/, /刷评价/, /虚构交易/, /编造(?:交易记录|交易|订单|销量)/],
  },
  {
    ruleId: 'CN-REQ-FAKE-REVIEW',
    reason: '该请求是在索要虚假好评、伪造评价或虚构用户证言，不能代为生成。',
    intent: [
      /(?:帮|替)我(?:写|生成|编造|来)?(?:虚假好评|伪造评价|假好评|虚假评价|虚构证言)/,
      /(?:写|生成|编造|来|给)[^。\n]{0,8}(?:\d+|[一二两三四五六七八九十百]{1,4}|几|若干|一批)\s*条[^。\n]{0,10}?(?:五星|5\s*星)?好评(?!回复|返现|率|如潮)/,
      /(?:假装|冒充|扮演)[^。\n]{0,20}(?:真实|满意)?(?:的)?(?:用户|顾客|客户|买家|患者|消费者)[^。\n]{0,30}(?:好评|评价|评论|证言|推荐)/,
      /\b(?:write|create|generate|make|produce|draft|compose|fabricate|invent|buy|order|purchase)\b[^.\n]{0,60}?\b(?:fake|fabricated|made[- ]up|invented|bogus|phony)\s+(?:\w+\s+){0,2}(?:reviews?|testimonials?|endorsements?|ratings?)\b/i,
      /\b(?:write|create|generate|make|produce|draft|compose)\b[^.\n]{0,40}?\b(?:\d+|several|some|a few|ten|twenty|five|dozens?)\s+(?:5|five)[- ]star\s+(?:\w+\s+){0,2}(?:reviews?|ratings?)\b/i,
      /\b(?:pretend(?:ing)?|act(?:ing)?|pos(?:e|ing)|impersonat\w*|role[- ]?play(?:ing)?)\b[^.\n]{0,40}?\b(?:as|to be)\s+(?:a|an|the)?\s*(?:real|satisfied|happy|verified|actual)?\s*(?:customer|client|patient|user|buyer)\b[^.\n]{0,80}?\b(?:review|testimonial|endorse\w*|recommend\w*)/i,
    ],
    keywords: [
      /(?:虚假|伪造|虚构)(?:的)?(?:好评|用户评价|客户评价|买家评价|买家秀|证言|客户证言|用户证言)/,
      /(?:编造|伪造|虚构|杜撰)[^。\n]{0,8}(?:好评|用户评价|客户评价|买家评价|买家秀|证言|客户证言|用户证言|评价)/,
      /水军(?:好评|评论|评价)/,
      /\bfake\s+(?:reviews?|testimonials?)\b/i,
      /\bfabricated\s+testimonials?\b/i,
    ],
  },
];

/** 识别、讲解、劝阻。硬性索要（intent）不受这一条影响。 */
const DISCUSSION = /(?:如何识别|怎么识别|怎样识别|什么是|是什么|定义|识别|防范|举报|危害|违法|不要|切勿|禁止|反对|科普|打击|整治|曝光|警示|为什么|为何)|(?:\bhow to (?:spot|detect|identify|avoid)\b|\bwhat (?:is|are)\b|\bwhy\b|\billegal\b|\bdo not\b|\bdon't\b|\bexplaining\b|\bguide to\b|\bnever\b)/i;

function snippets(text: string, patterns: readonly RegExp[]): string[] {
  const matched: string[] = [];
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (!found) continue;
    const term = found[0].replace(/\s+/g, ' ').trim().slice(0, 30);
    if (term && !matched.includes(term)) matched.push(term);
  }
  return matched;
}

export function evaluateDomesticRequest(input: string | readonly string[]): DomesticRequestResult {
  const text = (Array.isArray(input) ? input.join('\n') : String(input || '')).normalize('NFKC').trim();
  const discussing = DISCUSSION.test(text);
  const hits: DomesticRequestHit[] = [];
  for (const rule of RULES) {
    const matched = [...snippets(text, rule.intent), ...(discussing ? [] : snippets(text, rule.keywords))];
    const unique = [...new Set(matched)];
    if (!unique.length) continue;
    hits.push({
      ruleId: rule.ruleId,
      severity: 'block',
      reason: rule.reason,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      sourceRetrievedAt: SOURCE_RETRIEVED_AT,
      matchedTerms: unique,
      humanOverrideAllowed: false,
    });
  }
  return { blocked: hits.length > 0, ruleSetVersion: DOMESTIC_REQUEST_RULESET_VERSION, hits };
}
