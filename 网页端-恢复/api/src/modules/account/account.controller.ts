import { Controller, Get, Delete, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: '获取平台账号列表' })
  async findAll(@Request() req: any, @Query('platform') platform?: string, @Query('status') status?: string) {
    return this.accountService.findAll(req.user.tenantId, { platform, status });
  }

  @Get(':id')
  @ApiOperation({ summary: '获取账号详情' })
  async findById(@Param('id') id: string, @Request() req: any) {
    return this.accountService.findById(id, req.user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除账号' })
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.accountService.delete(id, req.user.tenantId);
  }

  @Get(':platform/auth-url')
  @ApiOperation({ summary: '获取授权链接' })
  async getAuthUrl(@Param('platform') platform: string) {
    return this.accountService.getAuthUrl(platform);
  }
}
