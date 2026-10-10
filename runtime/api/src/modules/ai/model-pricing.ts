/**
 * 国内模型价目表（集中定义，唯一出处）。单位一律是**人民币元**——国内模型本来就按人民币计价，
 * 国内版的成本记录与「每日 AI 成本预算」都按人民币算，不再折算成美元
 * （原来按「1 美元 = 7 元」折成美元后再和美元预算比，这个汇率既没有出处也没有必要）。
 *
 * 为什么要有这张表：境内供应商的 OpenAI 兼容接口只返回 token 数，不返回金额
 * （原来记录里一律是 null），于是「租户每日成本预算」统计永远是 0、永远拦不住超额调用。
 *
 * 核对规则：
 *   - verified=true：已在官方定价页逐项核对，写明来源链接与**实际核对日期**；
 *   - verified=false：没能打开官方定价页核对，保持原来的保守估值并标「待核实」，不编数字。
 *   建议与合规资料同步，每 25 天人工复核一次。
 */

/** 单价单位：人民币元 / 每百万 token。 */
export interface TextModelPrice {
  inputCnyPerMillion: number;
  outputCnyPerMillion: number;
  verified: boolean;
  /** 官方来源（verified 时必填） */
  source?: string;
  /** 实际核对日期（YYYY-MM-DD，verified 时必填） */
  checkedAt?: string;
  note: string;
}

const DEEPSEEK_PRICING_ZH = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/';
const DEEPSEEK_UPDATES_ZH = 'https://api-docs.deepseek.com/zh-cn/updates/';
const DEEPSEEK_CHECKED_AT = '2026-10-10';

export const MODEL_PRICE_TABLE_VERSION = 'DeepSeek 2026-10-10 已核对；通义千问 / 通义万相 待核实';

export const DOMESTIC_TEXT_MODEL_PRICES: Record<string, TextModelPrice> = {
  // ── DeepSeek：官方中文定价页（元 / 百万 tokens）。
  // 页面实行峰谷价：高峰（北京时间工作日 9:00–12:00、14:00–18:00，不含法定节假日）价格为空闲时段的 2 倍。
  // 这里一律按「高峰价、缓存未命中」计：判断法定节假日需要另外的日历，按高峰价只会让预算偏早拦，不会失守。
  'deepseek-flash': {
    inputCnyPerMillion: 2,
    outputCnyPerMillion: 8,
    verified: true,
    source: DEEPSEEK_PRICING_ZH,
    checkedAt: DEEPSEEK_CHECKED_AT,
    note: 'DeepSeek-V4.1-Flash。官方：缓存未命中输入 空闲 1 元 / 高峰 2 元，输出 空闲 4 元 / 高峰 8 元（缓存命中输入 0.02 / 0.04 元）；按高峰价计',
  },
  'deepseek-v4-pro': {
    inputCnyPerMillion: 9,
    outputCnyPerMillion: 27,
    verified: true,
    source: DEEPSEEK_PRICING_ZH,
    checkedAt: DEEPSEEK_CHECKED_AT,
    note: 'DeepSeek-V4-Pro-0813。官方：缓存未命中输入 空闲 4.5 元 / 高峰 9 元，输出 空闲 13.5 元 / 高峰 27 元（缓存命中输入 0.15 / 0.30 元）；按高峰价计',
  },
  // 旧模型名：官方更新日志（2026-04-24）称 deepseek-chat / deepseek-reasoner「将于 2026-07-24 停止使用」，
  // 当前定价页已不再列出。保留原保守估值只为给历史调用记录计价，标「待核实」。
  'deepseek-chat': {
    inputCnyPerMillion: 4,
    outputCnyPerMillion: 16,
    verified: false,
    source: DEEPSEEK_UPDATES_ZH,
    note: '待核实：官方定价页已不再列出此模型名（更新日志称 2026-07-24 停用），保留原保守估值',
  },
  'deepseek-reasoner': {
    inputCnyPerMillion: 8,
    outputCnyPerMillion: 32,
    verified: false,
    source: DEEPSEEK_UPDATES_ZH,
    note: '待核实：官方定价页已不再列出此模型名（更新日志称 2026-07-24 停用），保留原保守估值',
  },
  // ── 通义千问：2026-10-10 尝试打开阿里云百炼官方价目页（help.aliyun.com/zh/model-studio/models），
  // 没能取得页面内容，无法核对，保持原值并标「待核实」。
  'qwen-turbo': { inputCnyPerMillion: 0.6, outputCnyPerMillion: 1.2, verified: false, note: '待核实：未能打开阿里云百炼官方价目页核对，保持原保守估值' },
  'qwen-plus': { inputCnyPerMillion: 1.6, outputCnyPerMillion: 4, verified: false, note: '待核实：未能打开阿里云百炼官方价目页核对，保持原保守估值' },
  'qwen-max': { inputCnyPerMillion: 4.8, outputCnyPerMillion: 19.2, verified: false, note: '待核实：未能打开阿里云百炼官方价目页核对，保持原保守估值' },
};

/** 不在表里的模型按表中最贵的一档计价（保守），并在日志里提示补表。 */
export const UNKNOWN_TEXT_MODEL_PRICE: TextModelPrice = {
  inputCnyPerMillion: Math.max(...Object.values(DOMESTIC_TEXT_MODEL_PRICES).map((p) => p.inputCnyPerMillion)),
  outputCnyPerMillion: Math.max(...Object.values(DOMESTIC_TEXT_MODEL_PRICES).map((p) => p.outputCnyPerMillion)),
  verified: false,
  note: '未登记的模型：按表内最高单价计',
};

/** 文生图单价：人民币元 / 每张。2026-10-10 未能打开阿里云百炼官方价目页核对，保持原值并标「待核实」。 */
export const DOMESTIC_IMAGE_MODEL_PRICES: Record<string, { cnyPerImage: number; verified: boolean; note: string }> = {
  'wanx2.1-t2i-turbo': { cnyPerImage: 0.3, verified: false, note: '待核实：未能打开阿里云百炼官方价目页核对，保持原保守估值' },
  'wanx2.1-t2i-plus': { cnyPerImage: 0.4, verified: false, note: '待核实：未能打开阿里云百炼官方价目页核对，保持原保守估值' },
};
export const UNKNOWN_IMAGE_MODEL_CNY = 0.5;

/**
 * 一次图片生成计入套餐「本月 AI 令牌」额度的数量。
 *
 * 这**不是**任何服务商的官方折算（文生图按张计价，没有 token 概念），是本产品自定的额度口径：
 * 沿用代码里已有的「1 次 AI 调用 ≈ 2500 令牌」（usage.service 的 AI_CALL_TOKEN_EQUIVALENT，
 * 用于兼容旧的 max_ai_calls_monthly）。没有官方来源可核对，需要运营确认；界面上如实写「封面每张计 2,500 令牌」。
 */
export const IMAGE_TOKEN_EQUIVALENT = 2500;

function round6(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

export function textPriceFor(model: string): { price: TextModelPrice; known: boolean } {
  const key = String(model || '').trim().toLowerCase();
  const price = DOMESTIC_TEXT_MODEL_PRICES[key];
  return price ? { price, known: true } : { price: UNKNOWN_TEXT_MODEL_PRICE, known: false };
}

/** 按 token 数折算一次文本调用的金额（人民币元）。 */
export function estimateTextCost(model: string, promptTokens: number, completionTokens: number) {
  const { price, known } = textPriceFor(model);
  const input = Math.max(0, Number(promptTokens) || 0);
  const output = Math.max(0, Number(completionTokens) || 0);
  const cny = (input * price.inputCnyPerMillion + output * price.outputCnyPerMillion) / 1_000_000;
  return { cny: round6(cny), known };
}

/** 文生图金额（人民币元）。 */
export function estimateImageCost(model: string, images = 1) {
  const entry = DOMESTIC_IMAGE_MODEL_PRICES[String(model || '').trim().toLowerCase()];
  const cny = (entry ? entry.cnyPerImage : UNKNOWN_IMAGE_MODEL_CNY) * Math.max(0, images);
  return { cny: round6(cny), known: Boolean(entry) };
}
