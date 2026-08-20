import { Controller, Get, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  async getProfile(@Request() req: any) {
    const user = await this.userService.findById(req.user.sub);
    return { user };
  }

  @Put('me')
  @ApiOperation({ summary: '更新当前用户信息' })
  async updateProfile(@Request() req: any, @Body() data: { name?: string; avatar_url?: string; preferences?: any }) {
    const user = await this.userService.update(req.user.sub, data);
    return { user };
  }

  @Get('members')
  @ApiOperation({ summary: '获取团队成员列表' })
  async getMembers(@Request() req: any) {
    const members = await this.userService.findByTenant(req.user.tenantId);
    return { members };
  }

  @Get(':id')
  @ApiOperation({ summary: '获取用户详情' })
  async getById(@Param('id') id: string, @Request() req: any) {
    const user = await this.userService.findVisibleById(id, req.user.tenantId);
    return { user };
  }
}
