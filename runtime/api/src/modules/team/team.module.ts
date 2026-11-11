import { Module } from '@nestjs/common';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { RecordingTeamInviteMailer, TEAM_INVITE_MAILER } from './team-invite.mailer';

@Module({
  providers: [
    TeamService,
    // 默认只记录邀请，不发邮件、不访问网络。测试可以换成同一个令牌的替身。
    { provide: TEAM_INVITE_MAILER, useClass: RecordingTeamInviteMailer },
  ],
  controllers: [TeamController],
  exports: [TeamService],
})
export class TeamModule {}
