import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompetitorService } from './competitor.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('competitor')
@Controller('competitor')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompetitorController {
  constructor(private readonly competitorService: CompetitorService) {}

  @Get()
  @ApiOperation({ summary: '获取竞品监控列表' })
  async list(@Request() req: any) {
    return this.competitorService.listCompetitors(req.user.id);
  }

  @Get(':id/analysis')
  @ApiOperation({ summary: '获取竞品分析' })
  async getAnalysis(@Param('id') id: string, @Request() req: any) {
    // CompetitorMonitor 上的字段是 user_id 不是 tenant_id ——
    // 原来传 req.user.tenantId 即便接了库也查不到任何记录
    return this.competitorService.getCompetitorAnalysis(req.user.id, id);
  }
}
