import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

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

  @Get(':id')
  @ApiOperation({ summary: '获取内容详情' })
  async findById(@Param('id') id: string, @Request() req: any) {
    return this.contentService.findById(id, req.user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: '创建内容' })
  async create(@Request() req: any, @Body() data: any) {
    return this.contentService.create(req.user.tenantId, req.user.sub, data);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新内容' })
  async update(@Param('id') id: string, @Request() req: any, @Body() data: any) {
    return this.contentService.update(id, req.user.tenantId, req.user.sub, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除内容' })
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.contentService.delete(id, req.user.tenantId);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: '提交审核' })
  async submitForReview(@Param('id') id: string, @Request() req: any) {
    return this.contentService.submitForReview(id, req.user.tenantId);
  }

  @Post(':id/review')
  @ApiOperation({ summary: '审核内容' })
  async review(
    @Param('id') id: string,
    @Request() req: any,
    @Body() data: { action: 'approve' | 'reject'; comment?: string },
  ) {
    return this.contentService.review(id, req.user.tenantId, req.user.sub, data.action, data.comment);
  }
}
