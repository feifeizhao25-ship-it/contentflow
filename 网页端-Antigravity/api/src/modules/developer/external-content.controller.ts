import { Controller, Post, Body, UseGuards, Request, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ExternalApiGuard } from './external-api.guard';
import { ContentPackService } from '../ai/content-pack.service';
import { GenerateContentPackDto } from '../ai/dto/generate-content-pack.dto';
import { ApiRequestInterceptor } from './api-request.interceptor';

@ApiTags('external')
@UseGuards(ExternalApiGuard)
@UseInterceptors(ApiRequestInterceptor)
@Controller('external/v1/content-pack')
export class ExternalContentController {
    constructor(private readonly contentPackService: ContentPackService) { }

    @Post('generate')
    @ApiHeader({
        name: 'X-API-KEY',
        description: 'Developer API Key',
        required: true,
    })
    @ApiOperation({ summary: 'API: 一键生成内容包 (标题x10 + 脚本)' })
    @ApiResponse({ status: 201, description: '生成成功' })
    @ApiResponse({ status: 401, description: 'API Key 无效' })
    @ApiResponse({ status: 403, description: '额度不足' })
    async generate(@Request() req: any, @Body() dto: GenerateContentPackDto) {
        const tenantId = req.tenantId; // 来自 ExternalApiGuard
        return this.contentPackService.generatePack(tenantId, dto);
    }
}
