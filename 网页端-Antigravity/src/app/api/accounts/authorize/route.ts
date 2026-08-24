import { NextRequest, NextResponse } from 'next/server';
import { createClient, getTenantId } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { platform, cookie } = body;

        if (!platform) {
            return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
        }

        const tenantId = await getTenantId();
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock authorized account data
        const mockAccount = {
            tenant_id: tenantId,
            platform,
            account_name: `${platform.charAt(0).toUpperCase() + platform.slice(1)}用户_${Math.random().toString(36).substr(2, 4)}`,
            account_id: 'user_' + Math.random().toString(36).substr(2, 9),
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${platform}${Math.random()}`,
            follower_count: Math.floor(Math.random() * 10000),
            auth_type: cookie ? 'cookie' : 'oauth',
            status: 'active',
            // In a real app, we would store the cookie securely
        };

        const supabase = await createClient();
        const { data: savedAccount, error: saveError } = await supabase
            .from('platform_accounts')
            .insert(mockAccount)
            .select()
            .single();

        if (saveError) {
            console.error('Save error:', saveError);
            throw new Error(saveError.message);
        }

        return NextResponse.json({
            success: true,
            account: savedAccount,
        });
    } catch (error: any) {
        console.error('Authorize error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const tenantId = await getTenantId();
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();
        const { data: accounts, error } = await supabase
            .from('platform_accounts')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, accounts });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const tenantId = await getTenantId();
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();
        const { error } = await supabase
            .from('platform_accounts')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
