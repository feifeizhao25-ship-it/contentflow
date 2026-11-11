import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { RecordingTeamInviteMailer, TEAM_INVITE_MAILER } from './team-invite.mailer';
import { TeamModule } from './team.module';
import { TeamService } from './team.service';

/**
 * 邀请邮件是接口，编译后没有可注入的类型。TeamModule 必须自己提供 TEAM_INVITE_MAILER，
 * 否则 Nest 在启动 AppModule 时无法解析 TeamService（PR #100 引入的启动崩溃）。
 * Prisma 由全局 DatabaseModule 提供；这里用同样的全局替身，模块本身仍是真实的 TeamModule。
 */
@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: {} }],
  exports: [PrismaService],
})
class PrismaStubModule {}

describe('TeamModule wiring', () => {
  it('compiles the real TeamModule and resolves TeamService with its mailer', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaStubModule, TeamModule],
    }).compile();

    const service = moduleRef.get(TeamService);
    const mailer = moduleRef.get(TEAM_INVITE_MAILER);
    expect(service).toBeInstanceOf(TeamService);
    expect(mailer).toBeInstanceOf(RecordingTeamInviteMailer);
    expect((service as unknown as { mailer: unknown }).mailer).toBe(mailer);
    await moduleRef.close();
  });
});
