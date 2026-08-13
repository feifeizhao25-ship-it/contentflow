import type { ValidationArguments } from 'class-validator';

export function marketMessage(
  globalMessage: string,
  cnMessage: string,
): (args: ValidationArguments) => string {
  return () => process.env.MARKET_REGION === 'global' ? globalMessage : cnMessage;
}

export function defaultTenantSettings(globalMarket: boolean) {
  return globalMarket
    ? { timezone: 'UTC', language: 'en', notification_email: true }
    : { timezone: 'Asia/Shanghai', language: 'zh-CN', notification_email: true };
}
