import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { normalizeLang } from './own-data-overview';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: '数据分析页：本周 / 本月的发布任务、失败原因、AI 生成与采纳（只含自有数据）' })
  async getOverview(@Request() req: any, @Query('lang') lang?: string) {
    // lang=en：国际版客户端，失败原因 / AI 类型名 / 互动数据说明改为英文；默认中文
    return this.analyticsService.getOverview(req.user.tenantId, Date.now(), normalizeLang(lang));
  }

  @Get('dashboard')
  @ApiOperation({ summary: '获取数据看板' })
  async getDashboard(@Request() req: any, @Query('start') start?: string, @Query('end') end?: string) {
    return this.analyticsService.getDashboard(req.user.tenantId, {
      start: start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end) : new Date(),
    });
  }
}
