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

  @Get(':id/analysis')
  @ApiOperation({ summary: '获取竞品分析' })
  async getAnalysis(@Param('id') id: string, @Request() req: any) {
    return this.competitorService.getCompetitorAnalysis(req.user.tenantId, id);
  }
}
