import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createSubscription, purchaseCredits, PRICING_CONFIG, CREDIT_PACKS } from '@/lib/payment-service';

// POST /api/payment - 创建支付
export async function POST(request: NextRequest) {
    try {
        // 验证用户登录
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return NextResponse.json(
                { success: false, error: '请先登录' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { type, planId, packId } = body;

        if (type === 'subscription') {
            // 订阅套餐
            const config = PRICING_CONFIG[planId as keyof typeof PRICING_CONFIG];
            if (!config) {
                return NextResponse.json(
                    { success: false, error: '无效的套餐' },
                    { status: 400 }
                );
            }

            // 创建支付订单（这里可以接入真实支付渠道）
            const orderId = `sub_${Date.now()}_${user.id}`;
            
            // 直接升级订阅（演示用，实际应该先创建订单再支付）
            const subscription = await createSubscription(user.id, planId, { months: 1 });

            return NextResponse.json({
                success: true,
                data: {
                    orderId,
                    amount: config.monthlyPrice,
                    plan: planId,
                    subscription
                }
            });
        }

        if (type === 'credits') {
            // 积分充值
            const pack = CREDIT_PACKS.find(p => p.id === packId);
            if (!pack) {
                return NextResponse.json(
                    { success: false, error: '无效的积分包' },
                    { status: 400 }
                );
            }

            const orderId = `credits_${Date.now()}_${user.id}`;
            const result = await purchaseCredits(user.id, packId);

            return NextResponse.json({
                success: result.success,
                data: {
                    orderId,
                    amount: pack.price,
                    creditsAdded: result.creditsAdded,
                    message: result.message
                }
            });
        }

        return NextResponse.json(
            { success: false, error: '无效的支付类型' },
            { status: 400 }
        );

    } catch (error) {
        console.error('Payment error:', error);
        return NextResponse.json(
            { success: false, error: '支付处理失败' },
            { status: 500 }
        );
    }
}

// GET /api/payment - 获取支付状态/历史
export async function GET(request: NextRequest) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return NextResponse.json(
                { success: false, error: '请先登录' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'history';

        if (action === 'history') {
            // 获取支付历史
            const { data: payments } = await supabase
                .from('payment_records')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            return NextResponse.json({
                success: true,
                data: payments || []
            });
        }

        if (action === 'subscription') {
            // 获取当前订阅
            const { data: subscription } = await supabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .single();

            return NextResponse.json({
                success: true,
                data: subscription || { plan: 'free' }
            });
        }

        return NextResponse.json(
            { success: false, error: '无效的查询类型' },
            { status: 400 }
        );

    } catch (error) {
        console.error('Get payment error:', error);
        return NextResponse.json(
            { success: false, error: '查询失败' },
            { status: 500 }
        );
    }
}
