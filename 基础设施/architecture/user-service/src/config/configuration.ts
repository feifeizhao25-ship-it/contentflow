const isProduction = process.env.NODE_ENV === 'production';

function requiredInProduction(name: string, fallback: string): string {
  const value = process.env[name];
  if (isProduction && (!value || value.includes('your-') || value === 'password')) {
    throw new Error(`${name} must be explicitly configured for production`);
  }
  return value || fallback;
}

export default () => ({
    password: requiredInProduction('DB_PASSWORD', 'password'),
    synchronize: !isProduction && process.env.DB_SYNC === 'true',
    secret: requiredInProduction('JWT_SECRET', 'development-jwt-secret'),
    refreshSecret: requiredInProduction('JWT_REFRESH_SECRET', 'development-refresh-secret'),