import { NextRequest, NextResponse } from 'next/server';

// 奖励配置
const REWARD_CONFIG: Record<string, { points: number; badge?: string; vipDays?: number; message: string }> = {
  step3: {
    points: 50,
    message: '完成首次脚本生成',
  },
  step4: {
    points: 0,
    vipDays: 3,
    message: '完成首次视频生成',
  },
  step5: {
    points: 100,
    badge: 'new_star',
    message: '完成新手引导',
  },
  completion: {
    points: 50,
    badge: 'new_star',
    message: '完成完整新手引导',
  },
};

// POST /api/onboarding/reward - 发放新手引导奖励
export async function POST(request: NextRequest) {
  try {
    // TODO: 集成完整的认证系统
    const userId = request.headers.get('x-user-id') || 'demo-user';
    
    if (!userId || userId === 'demo-user') {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { rewardType } = body;

    const reward = REWARD_CONFIG[rewardType];
    
    if (!reward) {
      return NextResponse.json({ error: '无效的奖励类型' }, { status: 400 });
    }

    // TODO: 发放积分奖励（集成pointsService）
    if (reward.points > 0) {
      console.log(`[Onboarding Reward] Adding ${reward.points} points to user ${userId}`);
      // await pointsService.addPoints(userId, reward.points, reward.message);
    }

    // TODO: 发放VIP天数（需要集成会员系统）
    if (reward.vipDays) {
      console.log(`[Onboarding Reward] VIP days to add: ${reward.vipDays} for user ${userId}`);
    }

    // TODO: 发放徽章（需要集成成就系统）
    if (reward.badge) {
      console.log(`[Onboarding Reward] Badge to award: ${reward.badge} for user ${userId}`);
    }

    return NextResponse.json({
      success: true,
      reward: {
        points: reward.points,
        vipDays: reward.vipDays,
        badge: reward.badge,
      },
      message: `奖励已发放：+${reward.points}积分${reward.vipDays ? ` +${reward.vipDays}天VIP` : ''}${reward.badge ? ' +徽章' : ''}`,
    });
  } catch (error) {
    console.error('[Onboarding Reward] Error:', error);
    return NextResponse.json({ error: '发放奖励失败' }, { status: 500 });
  }
}

// GET /api/onboarding/reward - 获取奖励状态
export async function GET() {
  try {
    // 返回各步骤的奖励状态
    const rewardStatus = {
      step1: { completed: false, reward: null },
      step2: { completed: false, reward: null },
      step3: { 
        completed: false, 
        reward: { points: 50, type: 'points' },
        description: '生成首个脚本',
      },
      step4: { 
        completed: false, 
        reward: { vipDays: 3, type: 'vip' },
        description: '生成首个视频',
      },
      step5: { 
        completed: false, 
        reward: { points: 100, badge: 'new_star', type: 'mixed' },
        description: '完成新手引导',
      },
    };

    return NextResponse.json({
      success: true,
      rewardStatus,
      totalPotentialRewards: {
        points: 150,
        vipDays: 3,
        badges: ['new_star'],
      },
    });
  } catch (error) {
    console.error('[Onboarding Reward Status] Error:', error);
    return NextResponse.json({ error: '获取奖励状态失败' }, { status: 500 });
  }
}
