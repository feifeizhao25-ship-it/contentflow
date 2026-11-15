import { HttpException, HttpStatus } from '@nestjs/common';
import { AI_MONTHLY_QUOTA_MESSAGE } from '../modules/system/usage.service';

/**
 * 免费档超额的统一错误。
 *
 * 文章、脚本、标题、图片、爆款分析、内容包原来就用这个码（HTTP 429，error: AI_MONTHLY_QUOTA）。
 * 改写和发布超额走同一份，避免有的接口 400、有的 429，前端对不上码。
 * 发布条数用完时正文仍写发布次数，不把发布额度说成 AI 令牌。
 */
export const QUOTA_ERROR_CODE = 'AI_MONTHLY_QUOTA';

export const PUBLISH_MONTHLY_QUOTA_MESSAGE = '本月发布次数已达上限，请升级套餐或下月再发';

export function quotaExceededException(message: string = AI_MONTHLY_QUOTA_MESSAGE): HttpException {
  return new HttpException({ message, error: QUOTA_ERROR_CODE }, HttpStatus.TOO_MANY_REQUESTS);
}
