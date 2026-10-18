import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeamService } from './team.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('team')
@Controller('team')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('members')
  @ApiOperation({ summary: '获取团队成员' })
  async getMembers(@Request() req: any) {
    return this.teamService.getMembers(req.user.tenantId);
  }

  @Get('activity')
  @ApiOperation({ summary: '团队动态' })
  async getActivity(@Request() req: any) {
    return this.teamService.getActivity(req.user.tenantId);
  }

  @Delete('members/:userId')
  @ApiOperation({ summary: '移除团队成员（所有者/管理员）' })
  async removeMember(@Request() req: any, @Param('userId') userId: string) {
    return this.teamService.removeMember(req.user.tenantId, req.user.userId ?? req.user.id ?? req.user.sub, userId);
  }

  @Post('members')
  @ApiOperation({ summary: '添加团队成员' })
  async addMember(@Request() req: any, @Body() body: any) {
    return this.teamService.addMember(req.user.tenantId, body);
  }
}
