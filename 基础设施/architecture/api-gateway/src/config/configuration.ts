const isProduction = process.env.NODE_ENV === 'production';

function requiredInProduction(name: string, fallback: string): string {
  const value = process.env[name];
  if (isProduction && (!value || value === '*' || value.includes('your-'))) {
    throw new Error(`${name} must be explicitly configured for production`);
  }
  return value || fallback;
}

export default () => ({
    secret: requiredInProduction('JWT_SECRET', 'development-jwt-secret'),
    refreshSecret: requiredInProduction('JWT_REFRESH_SECRET', 'development-refresh-secret'),
  corsOrigin: requiredInProduction('CORS_ORIGIN', '*'),