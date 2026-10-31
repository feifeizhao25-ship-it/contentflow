/**
 * 注册时必须勾选「我已满 16 周岁」（2026-10-31，助手代用户决定，待法务复核）。
 * 国内版返回中文，国际版（MARKET_REGION=global）返回英文。只认布尔 true，字符串 'true' 也不行。
 */
export const AGE_CONFIRMATION_MESSAGE =
  process.env.MARKET_REGION === 'global'
    ? 'Please confirm that you are 16 or older'
    : '请确认您已年满 16 周岁';
