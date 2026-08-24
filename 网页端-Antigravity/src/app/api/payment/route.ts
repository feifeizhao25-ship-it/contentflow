import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { activateSubscription, SUBSCRIPTION_PLANS, getUserSubscription } from '@/lib/payment-service';

// POST /api/payment - 创建支付
export async function POST(request: NextRequest) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
        }

        const body = await request.json();
        const { type, planId } = body;

        if (type === 'subscription') {
            const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
            if (!plan) {
                return NextResponse.json({ success: false, error: '无效的套餐' }, { status: 400 });
            }

            // 直接升级订阅
            const subscription = await activateSubscription(user.id, planId);
            return NextResponse.json({
                success: true,
                data: {
                    orderId: `sub_${Date.now()}`,
                    amount: plan.price,
                    plan: planId,
                    subscription
                }
            });
        }

        if (type === 'credits') {
            return NextResponse.json({
                success: true,
                data: {
                    orderId: `credits_${Date.now()}`,
                    amount: 100,
                    creditsAdded: 100,
                    message: '充值成功 (Demo)'
                }
            });
        }

        return NextResponse.json({ success: false, error: '无效的支付类型' }, { status: 400 });

    } catch (error) {
        console.error('Payment error:', error);
        return NextResponse.json({ success: false, error: '支付处理失败' }, { status: 500 });
    }
}

// GET /api/payment - 获取支付状态/历史
export async function GET(request: NextRequest) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'history';

        if (action === 'history') {
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
            const subscription = await getUserSubscription(user.id);
            return NextResponse.json({
                success: true,
                data: subscription || { plan: 'free' }
            });
        }

        return NextResponse.json({ success: false, error: '无效的查询类型' }, { status: 400 });

    } catch (error) {
        console.error('Get payment error:', error);
        return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
    }
}
