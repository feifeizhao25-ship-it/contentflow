import { NextRequest, NextResponse } from 'next/server';
import { createClient, getTenantId } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { results, topic } = body;

        const tenantId = await getTenantId();
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();

        // Save each platform's result as a draft content
        const savedContents = [];
        for (const res of results) {
            const { data: content, error: contentError } = await supabase
                .from('contents')
                .insert({
                    tenant_id: tenantId,
                    title: res.title || topic || '未命名内容',
                    body: res.content || '',
                    content_type: res.videoUrl ? 'video' : 'article',
                    media_urls: [...res.images, res.videoUrl].filter(Boolean),
                    status: 'draft',
                    source: 'ai_generated',
                    ai_params: { platform: res.platform, topic: topic }
                })
                .select()
                .single();

            if (!contentError && content) {
                savedContents.push(content);
            }
        }

        return NextResponse.json({
            success: true,
            count: savedContents.length
        });
    } catch (error: any) {
        console.error('Save history error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        console.log('=== GET /api/ai/save-history called ===');

        const tenantId = await getTenantId();
        console.log('TenantId:', tenantId);

        if (!tenantId) {
            console.log('No tenantId found, returning empty contents');
            return NextResponse.json({
                success: true,
                contents: []
            });
        }

        const supabase = await createClient();
        console.log('Supabase client created');

        const { data: contents, error } = await supabase
            .from('contents')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('source', 'ai_generated')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Supabase query error:', error);
            // Return empty array instead of throwing
            return NextResponse.json({
                success: true,
                contents: [],
                error: error.message
            });
        }

        console.log('Found contents:', contents?.length || 0);
        return NextResponse.json({ success: true, contents: contents || [] });
    } catch (error: any) {
        console.error('GET history error:', error);
        // Return empty array instead of 500
        return NextResponse.json({
            success: true,
            contents: [],
            error: error.message
        });
    }
}
