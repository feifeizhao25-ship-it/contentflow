import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeamService } from './team.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateTeamInviteDto, TeamInviteTokenDto } from './dto/team-invite.dto';

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
    return this.teamService.removeMember(req.user.tenantId, req.user.id, userId);
  }

  @Post('members')
  @ApiOperation({ summary: '按邮箱创建团队邀请（不直接加入）' })
  async addMember(@Request() req: any, @Body() body: CreateTeamInviteDto) {
    return this.teamService.addMember(req.user.tenantId, req.user.id, body);
  }

  @Post('invites')
  @ApiOperation({ summary: '创建邮箱或链接邀请' })
  async createInvite(@Request() req: any, @Body() body: CreateTeamInviteDto) {
    return this.teamService.createInvite(req.user.tenantId, req.user.id, body);
  }

  @Get('invites')
  @ApiOperation({ summary: '列出本工作区的邀请' })
  async listInvites(@Request() req: any) {
    return this.teamService.listInvites(req.user.tenantId, req.user.id);
  }

  @Post('invites/:id/revoke')
  @ApiOperation({ summary: '撤销尚未使用的邀请' })
  async revokeInvite(@Request() req: any, @Param('id') id: string) {
    return this.teamService.revokeInvite(req.user.tenantId, req.user.id, id);
  }

  @Post('invites/accept')
  @ApiOperation({ summary: '接受邀请' })
  async acceptInvite(@Request() req: any, @Body() body: TeamInviteTokenDto) {
    return this.teamService.acceptInvite(req.user.id, body.token);
  }

  @Post('invites/decline')
  @ApiOperation({ summary: '拒绝邀请' })
  async declineInvite(@Request() req: any, @Body() body: TeamInviteTokenDto) {
    return this.teamService.declineInvite(req.user.id, body.token);
  }
}
