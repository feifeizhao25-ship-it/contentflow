import { AchievementModule } from './modules/achievement/achievement.module';
import { CompetitorModule } from './modules/competitor/competitor.module';
import { GrowthModule } from './modules/growth/growth.module';
import { HotModule } from './modules/hot/hot.module';
import { PointsModule } from './modules/points/points.module';
import { QuestModule } from './modules/quest/quest.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { marketModulesFor } from './app.module';

describe('market module isolation', () => {
  const domesticModules = [
    HotModule,
    CompetitorModule,
    GrowthModule,
    PointsModule,
    RewardsModule,
    QuestModule,
    AchievementModule,
  ];

  it('does not register domestic-only controllers in the global API', () => {
    expect(marketModulesFor('global')).toEqual([]);
  });

  it('keeps domestic-only controllers available in the CN API', () => {
    expect(marketModulesFor('cn')).toEqual(domesticModules);
  });

  it('fails safely toward the existing CN surface outside production', () => {
    expect(marketModulesFor(undefined)).toEqual(domesticModules);
  });
});
