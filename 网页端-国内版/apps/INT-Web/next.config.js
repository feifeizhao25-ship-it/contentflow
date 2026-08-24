const { withSentryConfig } = require('@sentry/nextjs');

function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_GATEWAY_URL',
  ];
  for (const key of required) {
    const value = process.env[key];
    if (!value || value.trim() === '' || value.includes('placeholder')) {
      throw new Error(`Build validation failed: ${key} is required and cannot be a placeholder.`);
    }
    if (key.endsWith('_URL') && (!value.startsWith('https://') || /localhost|127\.0\.0\.1/.test(value))) {
      throw new Error(`Build validation failed: ${key} must be a non-local HTTPS URL.`);
    }
  }
}
validateProductionEnv();

    : "'self' 'unsafe-inline'";