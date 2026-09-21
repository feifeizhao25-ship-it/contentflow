import * as Sentry from '@sentry/nextjs';
import { domesticSentryDsn } from './lib/sentry-dsn';

export async function register() {
  const dsn = domesticSentryDsn(process.env.SENTRY_DSN);
  if (process.env.SENTRY_DSN && !dsn) {
    console.warn('SENTRY_DSN 不是境内自建 Sentry 的 https 地址，已停用错误上报');
  }
  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    sendDefaultPii: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
