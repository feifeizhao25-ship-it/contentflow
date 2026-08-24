import { NextResponse } from 'next/server';
import registry from '@/lib/entitlements.json';
import { validateEntitlements } from '@/lib/entitlements';

// 会员权益注册表的同源出口：后端/客服可直接读取本路由，避免多份口径。
export async function GET() {
    const errors = validateEntitlements(registry);
    if (errors.length > 0) {
        return NextResponse.json(
            { message: '权益注册表校验失败', errors },
            { status: 500 },
        );
    }
    return NextResponse.json(registry, {
        headers: { 'cache-control': 'public, max-age=300' },
    });
}
