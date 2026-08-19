import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
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

  @Post('members')
  @ApiOperation({ summary: '添加团队成员' })
  async addMember(@Request() req: any, @Body() body: any) {
    return this.teamService.addMember(req.user.tenantId, body);
  }
}
