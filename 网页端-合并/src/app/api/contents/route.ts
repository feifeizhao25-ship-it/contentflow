import { NextRequest, NextResponse } from 'next/server';
import { createClient, getTenantId } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    try {
        const tenantId = await getTenantId();
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();
        const { data: contents, error } = await supabase
            .from('contents')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, contents });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const tenantId = await getTenantId();
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { title, body: contentBody, content_type, media_urls, tags, source } = body;

        const supabase = await createClient();
        const { data: content, error } = await supabase
            .from('contents')
            .insert({
                tenant_id: tenantId,
                title: title || '未命名内容',
                body: contentBody || '',
                content_type: content_type || 'article',
                media_urls: media_urls || [],
                tags: tags || [],
                status: 'draft',
                source: source || 'manual',
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, content });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
