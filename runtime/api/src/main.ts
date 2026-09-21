import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const production = process.env.NODE_ENV === 'production';
  
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: production
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  const configService = app.get(ConfigService);
  
  const allowedOrigins = configService
    .get<string>('CORS_ORIGIN', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  // 前缀、CORS、校验、异常与响应包装、反向代理信任：见 bootstrap.ts（测试也用同一份配置）。
  configureApp(app, allowedOrigins);
  
  // Swagger文档
  const swaggerConfig = new DocumentBuilder()
    .setTitle('分发侠 API')
    .setDescription('全渠道内容分发SaaS平台 API文档')
    .setVersion('2.0')
    .addBearerAuth()
    .addTag('auth', '认证模块')
    .addTag('users', '用户模块')
    .addTag('contents', '内容管理')
    .addTag('accounts', '平台账号')
    .addTag('publish', '发布管理')
    .addTag('ai', 'AI创作')
    .addTag('analytics', '数据分析')
    .addTag('hot', '热点追踪')
    .addTag('competitor', '竞品分析')
    .addTag('team', '团队协作')
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
