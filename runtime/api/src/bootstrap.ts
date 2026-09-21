import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

/**
 * 不带 `api/v1` 前缀的路径。
 *
 * 容器健康检查（Dockerfile HEALTHCHECK 与 compose healthcheck）打的是 `/health/ready`。
 * 原来这里只排除了 `health`，而 compose 打的是 `/api/v1/health/ready` —— 两个都不存在，
 * 永远 404：api-cn 永远 unhealthy，`depends_on: service_healthy` 的 web-cn 与网关
 * 于是**一个都不会启动**。
 */
export const UNPREFIXED_PATHS = ['health', 'health/ready', 'docs'];

/**
 * 反向代理层数：浏览器 → Caddy → web-cn（Next 路由转发）→ api。
 * Caddy 把真实客户端地址追加进 X-Forwarded-For，Next 原样转发；api 只信任最近一跳，
 * 于是 req.ip 取到的是 Caddy 追加的那一个——客户端自己伪造的前缀不起作用。
 * 不设这个的话，限流看到的永远是 web-cn 容器的地址：全站所有人共用一个额度。
 */
export const TRUSTED_PROXY_HOPS = 1;

export function configureApp(app: INestApplication, corsOrigins: string[]): void {
  (app as NestExpressApplication).set?.('trust proxy', TRUSTED_PROXY_HOPS);
  app.setGlobalPrefix('api/v1', { exclude: UNPREFIXED_PATHS });
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
}
