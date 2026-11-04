import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GrowthService } from './growth.service';
import { GrowthTrafficService } from './growth-traffic.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { HomeService } from '../home/home.service';
import { skillById } from './skills/catalog';

@ApiTags('growth')
@Controller('growth')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GrowthController {
  constructor(
    private readonly growthService: GrowthService,
    private readonly traffic: GrowthTrafficService,
    private readonly home: HomeService,
  ) {}

  @Get('plan')
  @ApiOperation({ summary: '获取增长计划' })
  async getPlan(@Request() req: any) {
    // GrowthGoal 上的字段是 user_id 不是 tenant_id
    const plan = await this.growthService.getGrowthPlan(req.user.id);
    // I-10：计划只有在用户设了目标时才变；把账号近 7 天的真实活动一并给出，计划页才随用户的操作变化。没有活动就是 0，不编。
    const signals = await this.home.signalsForUser(req.user.id);
    return { ...plan, activity_7d: { content_created: signals.content_7d, published: signals.published_7d, failed: signals.failed_7d, scheduled_upcoming: signals.scheduled_upcoming, connected_platforms: signals.platforms, materials: signals.materials } };
  }

  @Put('plan')
  @ApiOperation({ summary: '更新增长计划' })
  async updatePlan(@Request() req: any, @Body() body: any) {
    return this.growthService.updateGrowthPlan(req.user.id, body);
  }

  @Get('skills')
  @ApiOperation({ summary: '流量技能目录' })
  listSkills() {
    return { skills: this.traffic.listSkills() };
  }

  @Post('skills/:id/draft')
  @ApiOperation({ summary: '生成技能草稿，不发布' })
  draftSkill(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    if (!skillById(id)) throw new NotFoundException('未知技能');
    const input = body.input && typeof body.input === 'object' ? (body.input as Record<string, unknown>) : body;
    return this.traffic.draft(id, input);
  }

  @Get('rag/status')
  @ApiOperation({ summary: '增长知识库开关状态' })
  ragStatus() {
    return this.traffic.ragStatus();
  }

  @Post('events')
  @ApiOperation({ summary: '记录漏斗事件' })
  async recordEvent(@Request() req: any, @Body() body: Record<string, unknown>) {
    try {
      return await this.traffic.recordForUser(req.user, body ?? {});
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : '请求不正确');
    }
  }

  @Get('funnel')
  @ApiOperation({ summary: '当前工作区的流量到付费漏斗' })
  funnel(@Request() req: any) {
    return this.traffic.funnelForTenant(req.user.tenantId);
  }
}

@ApiTags('growth')
@Controller('growth')
export class GrowthPublicController {
  constructor(private readonly traffic: GrowthTrafficService) {}

  @Post('visits')
  @ApiOperation({ summary: '记录官网访问。只收访客编号和来源，不收个人身份信息。' })
  recordVisit(@Body() body: Record<string, unknown>) {
    try {
      return this.traffic.recordPublicVisit(body ?? {});
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : '请求不正确');
    }
  }
}
