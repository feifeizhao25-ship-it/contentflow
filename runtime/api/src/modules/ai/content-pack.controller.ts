import { Controller, Post, Body, UseGuards, UseInterceptors, Request, Headers } from '@nestjs/common';
import { AiConcurrencyInterceptor } from './ai-concurrency.interceptor';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ContentPackService } from './content-pack.service';
import { GenerateContentPackDto } from './dto/generate-content-pack.dto';
import { normalizeIdempotencyKey } from '../system/usage.service';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(AiConcurrencyInterceptor)
@Controller('content-pack')
export class ContentPackController {
    constructor(private readonly contentPackService: ContentPackService) { }

    @Post('generate')
    @ApiOperation({ summary: '生成完整内容包 (标题x10 + 脚本)' })
    @ApiResponse({ status: 201, description: '生成成功' })
    @ApiResponse({ status: 403, description: '额度不足' })
    async generate(@Request() req: any, @Body() dto: GenerateContentPackDto, @Headers('idempotency-key') idempotencyKey?: string) {
        return this.contentPackService.generatePack(req.user.tenantId, dto, req.user.sub, normalizeIdempotencyKey(idempotencyKey));
    }
}
