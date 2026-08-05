import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const production = process.env.NODE_ENV === 'production';
  
  const app = await NestFactory.create(AppModule, {
    logger: production
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  const configService = app.get(ConfigService);
  const marketRegion = configService.get<string>('MARKET_REGION', production ? '' : 'global');
  
  // 全局前缀
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'docs'],
  });
  
  // CORS配置
  const allowedOrigins = configService
    .get<string>('CORS_ORIGIN', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  
  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  
  // 全局过滤器
  app.useGlobalFilters(new HttpExceptionFilter());
  
  // 全局拦截器
  app.useGlobalInterceptors(new TransformInterceptor());
  
  // Swagger文档
  const globalMarket = marketRegion === 'global';
  const swaggerConfig = new DocumentBuilder()
    .setTitle(globalMarket ? 'ContentFlow API' : '分发侠 API')
    .setDescription(globalMarket ? 'Omnichannel content operations API' : '全渠道内容分发 SaaS 平台 API 文档')
    .setVersion('2.0')
    .addBearerAuth()
    .addTag('auth', globalMarket ? 'Authentication' : '认证模块')
    .addTag('users', globalMarket ? 'Users' : '用户模块')
    .addTag('contents', globalMarket ? 'Content' : '内容管理')
    .addTag('accounts', globalMarket ? 'Platform accounts' : '平台账号')
    .addTag('publish', globalMarket ? 'Publishing' : '发布管理')
    .addTag('ai', globalMarket ? 'AI creation' : 'AI创作')
    .addTag('analytics', globalMarket ? 'Analytics' : '数据分析')
    .addTag('hot', globalMarket ? 'Trends' : '热点追踪')
    .addTag('competitor', globalMarket ? 'Competitive intelligence' : '竞品分析')
    .addTag('team', globalMarket ? 'Team collaboration' : '团队协作')
    .build();
  
  if (!production || configService.get<string>('ENABLE_API_DOCS') === 'true') {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }
  
  const port = configService.get('PORT', 4000);
  const host = configService.get('HOST', '0.0.0.0');
  
  await app.listen(port, host);
  
  logger.log(`Application is running on: http://${host}:${port}`);
  if (!production || configService.get<string>('ENABLE_API_DOCS') === 'true') {
    logger.log(`Swagger documentation: http://${host}:${port}/docs`);
  }
}

bootstrap();
