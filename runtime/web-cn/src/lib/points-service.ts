import { supabase } from './supabase';

export interface UserPoints {
    id?: string;
    user_id: string;
    balance: number;
    total_earned: number;
    total_spent: number;
    consecutive_days: number;
    last_checkin_date: string | null;
    total_checkins: number;
    level: number;
    experience_points: number;
    created_at?: string;
    updated_at?: string;
}

// 积分规则
export const POINTS_RULES = {
    DAILY_CHECKIN_BASE: 10,
    DAILY_CHECKIN_MAX_STREAK: 7,
    CREATE_CONTENT: 20,
    PUBLISH_CONTENT: 30,
    INVITE_FRIEND: 100,
    COMPLETE_PROFILE: 50,
    FIRST_PUBLISH: 100,
    SHARE_CONTENT: 15,
};

// 积分兑换商品
export const REWARDS = [
    { id: 'ai_generations_10', name: 'AI生成次数 +10', points: 100, type: 'coupon', value: 10 },
    { id: 'ai_generations_50', name: 'AI生成次数 +50', points: 450, type: 'coupon', value: 50 },
    { id: 'pro_1day', name: '专业版体验 1天', points: 200, type: 'subscription', value: 1 },
    { id: 'pro_7day', name: '专业版体验 7天', points: 1200, type: 'subscription', value: 7 },
    { id: 'storage_1gb', name: '素材库容量 +1GB', points: 300, type: 'storage', value: 1024 },
];

// 获取用户积分信息
export async function getUserPoints(userId: string): Promise<UserPoints | null> {
    const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // 用户积分记录不存在，创建新记录
            return createUserPoints(userId);
        }
        console.error('Error fetching user points:', error);
        throw error;
    }

    return data;
}

// 创建用户积分记录
export async function createUserPoints(userId: string): Promise<UserPoints> {
    const { data, error } = await supabase
        .from('user_points')
        .insert({
            user_id: userId,
            balance: 0,
            total_earned: 0,
            total_spent: 0,
            consecutive_days: 0,
            last_checkin_date: null,
            total_checkins: 0,
            level: 1,
            experience_points: 0
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating user points:', error);
        throw error;
    }

    return data;
}

// 添加积分
export async function addPoints(userId: string, amount: number, reason: string): Promise<UserPoints | null> {
    try {
        const currentPoints = await getUserPoints(userId);
        
        if (!currentPoints) {
            return null;
        }

        const newBalance = currentPoints.balance + amount;
        const newExperience = currentPoints.experience_points + amount;
        const newLevel = calculateLevel(newExperience);

        const { data, error } = await supabase
            .from('user_points')
            .update({
                balance: newBalance,
                total_earned: currentPoints.total_earned + amount,
                experience_points: newExperience,
                level: newLevel,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error adding points:', error);
            throw error;
        }

        console.log(`+${amount} 积分: ${reason}`);
        return data;
    } catch (error) {
        console.error('addPoints error:', error);
        return null;
    }
}

// 扣除积分
export async function subtractPoints(userId: string, amount: number, reason: string): Promise<{ success: boolean; newBalance: number }> {
    try {
        const currentPoints = await getUserPoints(userId);
        
        if (!currentPoints || currentPoints.balance < amount) {
            console.log(`扣除失败: ${reason}，积分不足`);
            return { success: false, newBalance: currentPoints?.balance || 0 };
        }

        const { data, error } = await supabase
            .from('user_points')
            .update({
                balance: currentPoints.balance - amount,
                total_spent: currentPoints.total_spent + amount,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error subtracting points:', error);
            throw error;
        }

        console.log(`-${amount} 积分: ${reason}`);
        return { success: true, newBalance: data.balance };
    } catch (error) {
        console.error('subtractPoints error:', error);
        return { success: false, newBalance: 0 };
    }
}

// 签到
export async function checkIn(userId: string): Promise<{
    success: boolean;
    points_earned: number;
    streak_days: number;
    message: string;
}> {
    try {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        const currentPoints = await getUserPoints(userId);
        
        if (!currentPoints) {
            return { success: false, points_earned: 0, streak_days: 0, message: '签到失败' };
        }

        // 检查今天是否已签到
        if (currentPoints.last_checkin_date === today) {
            return { success: false, points_earned: 0, streak_days: currentPoints.consecutive_days, message: '今日已签到' };
        }

        // 计算连续签到加成
        let bonus = POINTS_RULES.DAILY_CHECKIN_BASE;
        let streakBonus = 0;

        if (currentPoints.last_checkin_date === yesterday) {
            // 连续签到
            const newStreak = currentPoints.consecutive_days + 1;
            streakBonus = Math.min(newStreak, POINTS_RULES.DAILY_CHECKIN_MAX_STREAK) * 5;
            bonus += streakBonus;
        }

        const totalBonus = bonus;
        const newStreak = currentPoints.last_checkin_date === yesterday 
            ? currentPoints.consecutive_days + 1 
            : 1;

        const { error } = await supabase
            .from('user_points')
            .update({
                balance: currentPoints.balance + totalBonus,
                total_earned: currentPoints.total_earned + totalBonus,
                consecutive_days: newStreak,
                last_checkin_date: today,
                total_checkins: currentPoints.total_checkins + 1,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (error) {
            throw error;
        }

        let message = `签到成功！+${totalBonus} 积分`;
        if (streakBonus > 0) {
            message += `（连续签到${newStreak}天加成）`;
        }

        return { success: true, points_earned: totalBonus, streak_days: newStreak, message };
    } catch (error) {
        console.error('checkIn error:', error);
        return { success: false, points_earned: 0, streak_days: 0, message: '签到失败' };
    }
}

// 计算等级
function calculateLevel(xp: number): number {
    const LEVEL_THRESHOLDS = [
        0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500,
        5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000,
        21000, 23100, 25300, 27600, 30000
    ];

    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (xp >= LEVEL_THRESHOLDS[i]) {
            return i + 1;
        }
    }
    return 1;
}

// 获取等级进度
export function getLevelProgress(userPoints: UserPoints): {
    currentXP: number;
    nextLevelXP: number;
    percentage: number;
} {
    const LEVEL_THRESHOLDS = [
        0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500,
        5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000,
        21000, 23100, 25300, 27600, 30000
    ];

    const currentLevelXP = LEVEL_THRESHOLDS[userPoints.level - 1] || 0;
    const nextLevelXP = LEVEL_THRESHOLDS[userPoints.level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 5000;
    const currentXP = userPoints.experience_points - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;
    const percentage = Math.min((currentXP / xpNeeded) * 100, 100);

    return {
        currentXP,
        nextLevelXP: xpNeeded,
        percentage
    };
}

// 记录积分变动日志
export async function logPointsTransaction(
    userId: string,
    amount: number,
    type: 'earn' | 'spend',
    reason: string,
    relatedId?: string
): Promise<void> {
    const { error } = await supabase
        .from('points_transactions')
        .insert({
            user_id: userId,
            amount,
            type,
            reason,
            related_id: relatedId || null
        });

    if (error) {
        console.error('Error logging points transaction:', error);
    }
}
