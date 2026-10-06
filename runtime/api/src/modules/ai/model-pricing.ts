/**
 * 国内模型价目表（集中定义，唯一出处）。
 *
 * ⚠ 以服务商官网价目为准，需定期核对（建议与合规资料同步，每 25 天人工复核一次）：
 *   - 通义千问 / 通义万相：阿里云百炼「模型调用计费」页面
 *   - DeepSeek：DeepSeek 开放平台「模型 & 价格」页面
 *
 * 为什么要有这张表：境内供应商的 OpenAI 兼容接口只返回 token 数，不返回金额
 * （原来记录里一律是 cost_usd: null），于是「租户每日成本预算」统计永远是 0、
 * 永远拦不住超额调用。现在按 token 数 × 本表单价折算金额后写进生成记录。
 *
 * 取值原则：写代码时无法联网核对当日官网价，所以下面的数值一律取
 * 「已知公开价目中的较高值，或在其基础上上浮」的保守估值，并标注「待核实」。
 * 宁可让预算提前拦，也不要让预算形同虚设。核对后请把 verified 改为 true 并写上核对日期。
 */

/** 单价单位：人民币元 / 每百万 token。 */
export interface TextModelPrice {
  inputCnyPerMillion: number;
  outputCnyPerMillion: number;
  verified: boolean;
  note: string;
}

export const MODEL_PRICE_TABLE_VERSION = '2026-10-06（待核实）';

export const DOMESTIC_TEXT_MODEL_PRICES: Record<string, TextModelPrice> = {
  'qwen-turbo': { inputCnyPerMillion: 0.6, outputCnyPerMillion: 1.2, verified: false, note: '待核实：按已知公开价约 2 倍取保守估值' },
  'qwen-plus': { inputCnyPerMillion: 1.6, outputCnyPerMillion: 4, verified: false, note: '待核实：按已知公开价约 2 倍取保守估值' },
  'qwen-max': { inputCnyPerMillion: 4.8, outputCnyPerMillion: 19.2, verified: false, note: '待核实：按已知公开价约 2 倍取保守估值' },
  'deepseek-chat': { inputCnyPerMillion: 4, outputCnyPerMillion: 16, verified: false, note: '待核实：按已知最高标准价约 2 倍取保守估值' },
  'deepseek-reasoner': { inputCnyPerMillion: 8, outputCnyPerMillion: 32, verified: false, note: '待核实：按已知最高标准价约 2 倍取保守估值' },
};

/** 不在表里的模型按表中最贵的一档计价（保守），并在日志里提示补表。 */
export const UNKNOWN_TEXT_MODEL_PRICE: TextModelPrice = {
  inputCnyPerMillion: Math.max(...Object.values(DOMESTIC_TEXT_MODEL_PRICES).map((p) => p.inputCnyPerMillion)),
  outputCnyPerMillion: Math.max(...Object.values(DOMESTIC_TEXT_MODEL_PRICES).map((p) => p.outputCnyPerMillion)),
  verified: false,
  note: '未登记的模型：按表内最高单价计',
};

/** 文生图单价：人民币元 / 每张。 */
export const DOMESTIC_IMAGE_MODEL_PRICES: Record<string, { cnyPerImage: number; verified: boolean; note: string }> = {
  'wanx2.1-t2i-turbo': { cnyPerImage: 0.3, verified: false, note: '待核实：按已知公开价约 2 倍取保守估值' },
  'wanx2.1-t2i-plus': { cnyPerImage: 0.4, verified: false, note: '待核实：按已知公开价约 2 倍取保守估值' },
};
export const UNKNOWN_IMAGE_MODEL_CNY = 0.5;

/**
 * 每日预算沿用原有的 AI_TENANT_DAILY_BUDGET_USD（美元口径，境外通道直接返回美元金额），
 * 所以人民币金额按固定汇率折成美元再写入 cost_amount。
 * 汇率取偏低值（1 美元 = 7 元）：折出的美元金额偏高，同样是保守方向。待核实。
 */
export const CNY_PER_USD_CONSERVATIVE = 7;

/**
 * 一次图片生成折算多少「AI 令牌」计入套餐月度额度。
 * 沿用代码里已有的「1 次 AI 调用 ≈ 2500 令牌」换算（见 billing.controller / usage.service 的 max_ai_calls_monthly 兼容逻辑）。
 * 这是产品口径，需要运营确认。
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

/** 按 token 数折算一次文本调用的金额（人民币元与美元）。 */
export function estimateTextCost(model: string, promptTokens: number, completionTokens: number) {
  const { price, known } = textPriceFor(model);
  const input = Math.max(0, Number(promptTokens) || 0);
  const output = Math.max(0, Number(completionTokens) || 0);
  const cny = (input * price.inputCnyPerMillion + output * price.outputCnyPerMillion) / 1_000_000;
  return { cny: round6(cny), usd: round6(cny / CNY_PER_USD_CONSERVATIVE), known };
}

export function estimateImageCost(model: string, images = 1) {
  const entry = DOMESTIC_IMAGE_MODEL_PRICES[String(model || '').trim().toLowerCase()];
  const cny = (entry ? entry.cnyPerImage : UNKNOWN_IMAGE_MODEL_CNY) * Math.max(0, images);
  return { cny: round6(cny), usd: round6(cny / CNY_PER_USD_CONSERVATIVE), known: Boolean(entry) };
}
