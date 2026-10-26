import { IMAGE_TOKEN_EQUIVALENT } from './model-pricing';

/**
 * 调用模型前占住的令牌上限。
 *
 * 实际消耗通常小于这个数：提示词长度加上输出上限，再留一点余量。
 * 成功后按供应商返回的实际 token 入账，多占的部分退回。
 * 图片没有 token 账单，按固定折算占住，成功后原数入账。
 */
export const AI_HOLD_TOKENS = {
  article: 8000,
  script: 5000,
  titles: 2000,
  viral: 4000,
  content_pack: 10000,
  image: IMAGE_TOKEN_EQUIVALENT,
} as const;
