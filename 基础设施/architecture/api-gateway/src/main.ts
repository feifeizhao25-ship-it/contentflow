  const configuredOrigins = configService
    .get<string>('corsOrigin', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: configuredOrigins,