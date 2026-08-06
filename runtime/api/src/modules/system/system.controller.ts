import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('system')
@Controller('health')
export class SystemController {
    constructor(
        private readonly prisma: PrismaService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
    ) {}

    @Get()
    @ApiOperation({ summary: '健康检查' })
    healthCheck() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'fenfa-ai-api',
            version: '1.0.0',
        };
    }

    @Get('ready')
    @ApiOperation({ summary: '依赖就绪检查' })
    async readinessCheck() {
        const checks: Record<'database' | 'redis', 'ok' | 'error'> = {
            database: 'error',
            redis: 'error',
        };

        try {
            await this.prisma.$queryRaw`SELECT 1`;
            checks.database = 'ok';
        } catch {
            checks.database = 'error';
        }

        try {
            checks.redis = (await this.redis.ping()) === 'PONG' ? 'ok' : 'error';
        } catch {
            checks.redis = 'error';
        }

        if (Object.values(checks).some((status) => status !== 'ok')) {
            throw new ServiceUnavailableException({
                status: 'not_ready',
                checks,
            });
        }

        return { status: 'ready', checks };
    }
}
