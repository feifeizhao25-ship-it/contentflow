/**
 * 客户端不能自己报「进度」「经验」来领积分。
 *
 * POST /gamification/xp、POST /api/quests/progress、POST /api/achievements/progress 让登录用户
 * 提交任意 amount / increment：把任务进度直接刷满 → 领奖励积分 → 积分商城里兑换 VIP，
 * 等于免费领会员。前端从未调用这三个接口（只读状态、签到、领取），
 * 进度应由服务端在真实业务事件（生成内容、发布成功……）里推进。
 *
 * 这里走真实的路由表：这三条路径必须不存在（404），且服务层没有被调用。
 * 领取（claim）、读取接口不受影响。
 */
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AchievementController } from '../achievement/achievement.controller';
import { AchievementService } from '../achievement/achievement.service';
import { QuestController } from '../quest/quest.controller';
import { QuestService } from '../quest/quest.service';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';

describe('客户端伪造进度 / 经验', () => {
  let app: INestApplication;
  const gamification = { addXp: jest.fn(), updateStreak: jest.fn(), getUserStatus: jest.fn(), getUserAchievements: jest.fn() };
  const quest = { updateQuestProgress: jest.fn(), claimQuestReward: jest.fn(), getAvailableQuests: jest.fn() };
  const achievement = { updateAchievementProgress: jest.fn(), claimAchievementReward: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [GamificationController, QuestController, AchievementController],
      providers: [
        { provide: GamificationService, useValue: gamification },
        { provide: QuestService, useValue: quest },
        { provide: AchievementService, useValue: achievement },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { id: 'u-me', sub: 'u-me', tenantId: 't', role: 'owner' };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  });
  afterEach(async () => app.close());

  it.each([
    ['/api/v1/gamification/xp', { amount: 1000, source: 'x' }],
    ['/api/v1/api/quests/progress', { questId: 'q1', increment: 9999 }],
    ['/api/v1/api/achievements/progress', { conditionType: 'publish', increment: 9999 }],
  ])('POST %s 不存在，且不会推进任何进度', async (path, body) => {
    const res = await request(app.getHttpServer()).post(path).send(body);
    expect(res.status).toBe(404);
    expect(gamification.addXp).not.toHaveBeenCalled();
    expect(quest.updateQuestProgress).not.toHaveBeenCalled();
    expect(achievement.updateAchievementProgress).not.toHaveBeenCalled();
  });

  it('领取奖励与签到仍然可用', async () => {
    quest.claimQuestReward.mockResolvedValue({ success: true });
    gamification.updateStreak.mockResolvedValue({ streak: 1 });
    await request(app.getHttpServer()).post('/api/v1/api/quests/claim').send({ questId: 'q1' }).expect(201);
    await request(app.getHttpServer()).post('/api/v1/gamification/streak').send({}).expect(201);
  });
});
