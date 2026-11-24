import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AppendContentAssetsDto, BatchDeleteContentDto, CreateContentDto, ReviewContentDto, SelfConfirmContentDto, UpdateContentDto } from './dto/content.dto';
import { REVIEWER_ROLES } from './content.service';

@ApiTags('contents')
@Controller('contents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @ApiOperation({ summary: '获取内容列表' })
  async findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
  ) {
    return this.contentService.findAll(req.user.tenantId, { status, page, pageSize, keyword });
  }

  @Get('review-policy')
  @ApiOperation({ summary: '当前用户的审核权限：能否审核、能否自行确认（单人工作区）' })
  async reviewPolicy(@Request() req: any) {
    return this.contentService.reviewPolicy(req.user.tenantId, { sub: req.user.sub, role: req.user.role });
  }

  @Get(':id/review-logs')
  @ApiOperation({ summary: '内容的审核记录' })
  async reviewLogs(@Param('id') id: string, @Request() req: any) {
    return this.contentService.reviewLogs(id, req.user.tenantId);
  }

  @Get(':id/assets')
  @ApiOperation({ summary: '内容的素材（正文脚本、封面、配图），由内容本身的字段组成' })
  async listAssets(@Param('id') id: string, @Request() req: any) {
    return this.contentService.listAssets(id, req.user.tenantId);
  }

  @Post(':id/assets')
  @ApiOperation({ summary: '保存素材到内容（只限草稿或已驳回；规则同更新内容）' })
  async appendAssets(@Param('id') id: string, @Request() req: any, @Body() data: AppendContentAssetsDto) {
    return this.contentService.appendAssets(id, req.user.tenantId, req.user.sub, data.assets);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取内容详情' })
  async findById(@Param('id') id: string, @Request() req: any) {
    return this.contentService.findById(id, req.user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: '创建内容' })
  async create(@Request() req: any, @Body() data: CreateContentDto) {
    return this.contentService.create(req.user.tenantId, req.user.sub, data);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新内容' })
  async update(@Param('id') id: string, @Request() req: any, @Body() data: UpdateContentDto) {
    return this.contentService.update(id, req.user.tenantId, req.user.sub, data);
  }

  @Post('batch-delete')
  @ApiOperation({ summary: '批量删除内容（逐条校验权限，汇总成功与失败数量）' })
  async deleteMany(@Request() req: any, @Body() data: BatchDeleteContentDto) {
    return this.contentService.deleteMany(data.ids, req.user.tenantId, { sub: req.user.sub, role: req.user.role });
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除内容' })
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.contentService.delete(id, req.user.tenantId, { sub: req.user.sub, role: req.user.role });
  }

  @Post(':id/submit')
  @ApiOperation({ summary: '提交审核' })
  async submitForReview(@Param('id') id: string, @Request() req: any) {
    return this.contentService.submitForReview(id, req.user.tenantId, req.user.sub);
  }

  @Post(':id/review')
  @ApiOperation({ summary: '审核内容' })
  async review(
    @Param('id') id: string,
    @Request() req: any,
    @Body() data: ReviewContentDto,
  ) {
    if (!REVIEWER_ROLES.includes(req.user.role)) {
      throw new ForbiddenException('仅工作区所有者或管理员可以审核内容');
    }
    return this.contentService.review(id, req.user.tenantId, req.user.sub, data.action, data.comment);
  }

  @Post(':id/self-confirm')
  @ApiOperation({ summary: '所有者自行确认（工作区没有其他审核人时；需二次确认，单独记录）' })
  async selfConfirm(@Param('id') id: string, @Request() req: any, @Body() data: SelfConfirmContentDto) {
    return this.contentService.selfConfirm(id, req.user.tenantId, { sub: req.user.sub, role: req.user.role }, data);
  }
}
