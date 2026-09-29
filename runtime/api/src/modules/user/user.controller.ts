import { Controller, Get, Post, Put, Param, Body, UseGuards, Request, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DeleteAccountDto, UpdateProfileDto } from './dto/update-profile.dto';
import { AccountErasureService, RETAINED_TABLES } from './account-erasure.service';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly erasure: AccountErasureService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  async getProfile(@Request() req: any) {
    const user = await this.userService.findById(req.user.sub);
    return { user };
  }

  @Put('me')
  @ApiOperation({ summary: '更新当前用户信息' })
  async updateProfile(@Request() req: any, @Body() data: UpdateProfileDto) {
    const user = await this.userService.update(req.user.sub, data);
    return { user };
  }

  // ─── 导出个人信息 / 注销账号 ───
  // 身份只取自令牌；两条路由都是两段路径，不会被下面的 ':id' 抢走。

  @Get('me/export')
  @ApiOperation({ summary: '导出我的个人信息（JSON）' })
  async exportMyData(@Request() req: any) {
    return this.erasure.export(req.user.sub);
  }

  @Post('me/delete-account')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 要输密码：防止拿它试口令
  @ApiOperation({ summary: '注销我的账号（不可恢复；订单与支付记录依法保留）' })
  async deleteAccount(@Request() req: any, @Body() dto: DeleteAccountDto) {
    await this.erasure.assertPassword(req.user.sub, dto.password);
    const result = await this.erasure.erase(req.user.sub);
    return {
      status: 'deleted',
      workspace_deleted: result.workspaceDeleted,
      retained: RETAINED_TABLES.map((r) => `${r.table}（${r.why}）`),
    };
  }

  @Get('members')
  @ApiOperation({ summary: '获取团队成员列表' })
  async getMembers(@Request() req: any) {
    const members = await this.userService.findByTenant(req.user.tenantId);
    return { members };
  }

  @Get(':id')
  @ApiOperation({ summary: '获取用户详情' })
  async getById(@Request() req: any, @Param('id') id: string) {
    const user = await this.userService.findInTenant(id, req.user.tenantId);
    return { user };
  }
}
