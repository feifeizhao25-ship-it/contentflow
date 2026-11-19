import { Controller, Get, Query, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReadonlyFunnelTokenGuard } from './readonly-token.guard';
import { SiteFunnelService, WeekError } from './weekly-funnel';

/**
 * 全站每周漏斗（只读）。只认 FENFAXIA_FUNNEL_READONLY_TOKEN，不认登录令牌；
 * 当前工作区的 GET /growth/funnel 保持不变。
 */
@ApiTags('growth')
@Controller('growth/site-funnel')
@UseGuards(ReadonlyFunnelTokenGuard)
@ApiBearerAuth()
export class SiteFunnelController {
  constructor(private readonly siteFunnel: SiteFunnelService) {}

  @Get('weekly')
  @ApiOperation({ summary: '全站每周漏斗汇总（上海时间周日至周六，只读、只出聚合）' })
  async weekly(@Query('week_start') weekStart?: string, @Query('weeks') weeks?: string) {
    try {
      return await this.siteFunnel.report({ week_start: weekStart, weeks });
    } catch (error) {
      if (error instanceof WeekError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }
}
