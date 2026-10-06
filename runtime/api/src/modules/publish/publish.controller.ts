import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PublishService } from './publish.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { normalizePaging } from '../../common/pagination';
import { CreatePublishTaskDto } from './dto/create-publish-task.dto';
import { ConfirmManualPublishDto, CreateManualPublishDto } from './dto/create-manual-publish.dto';

@ApiTags('publish')
@Controller('publish')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Post('tasks')
  @ApiOperation({ summary: '创建发布任务' })
  async createTask(@Request() req: any, @Body() body: CreatePublishTaskDto) {
    return this.publishService.createTask(req.user.tenantId, req.user.sub, body as Parameters<PublishService['createTask']>[2]);
  }

  @Post('manual-tasks')
  @ApiOperation({ summary: '创建人工确认发布任务（小红书 / 视频号 / 公众号）' })
  async createManualTasks(@Request() req: any, @Body() body: CreateManualPublishDto) {
    return this.publishService.createManualTasks(req.user.tenantId, req.user.sub, body);
  }

  @Get('tasks/:id/manual-kit')
  @ApiOperation({ summary: '人工发布素材：文案（含 AI 标识）、封面地址、平台操作说明' })
  async getManualKit(@Param('id') id: string, @Request() req: any) {
    return this.publishService.getManualKit(id, req.user.tenantId);
  }

  @Post('tasks/:id/manual-done')
  @ApiOperation({ summary: '确认已在平台手动发布，可回填作品链接（只保存链接）' })
  async confirmManual(@Param('id') id: string, @Request() req: any, @Body() body: ConfirmManualPublishDto) {
    return this.publishService.confirmManualPublished(id, req.user.tenantId, body?.postUrl);
  }

  @Get('tasks')
  @ApiOperation({ summary: '获取发布任务列表' })
  async getTasks(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const paging = normalizePaging(page, pageSize);
    return this.publishService.getTasks(req.user.tenantId, { status, page: paging.page, pageSize: paging.pageSize });
  }

  @Post('tasks/:id/retry')
  @ApiOperation({ summary: '重试失败的任务' })
  async retryTask(@Param('id') id: string, @Request() req: any) {
    return this.publishService.retryTask(id, req.user.tenantId);
  }

  @Post('tasks/:id/cancel')
  @ApiOperation({ summary: '取消任务' })
  async cancelTask(@Param('id') id: string, @Request() req: any) {
    return this.publishService.cancelTask(id, req.user.tenantId);
  }
}
