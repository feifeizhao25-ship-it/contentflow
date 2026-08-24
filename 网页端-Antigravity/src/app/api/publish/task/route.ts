import { NextRequest, NextResponse } from 'next/server';
import { createClient, getTenantId } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, body: contentBody, platforms, publishType, scheduledTime, contentType, media_urls, videoUrl } = body;

        const tenantId = await getTenantId();
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();

        // Ensure we have a valid list of media URLs
        const finalMediaUrls = media_urls || (videoUrl ? [videoUrl] : []);

        // 2. Create Content
        const { data: content, error: contentError } = await supabase
            .from('contents')
            .insert({
                tenant_id: tenantId,
                title: title || '未命名内容',
                body: contentBody || '',
                content_type: (videoUrl || contentType === 'video') ? 'video' : (contentType || 'article'),
                media_urls: finalMediaUrls,
                status: 'pending',
                source: 'ai_generated',
            })
            .select()
            .single();

        if (contentError) throw contentError;

        // 3. Create Publish Tasks
        let { data: accounts } = await supabase
            .from('platform_accounts')
            .select('id, platform')
            .eq('tenant_id', tenantId);

        const tasksToCreate = platforms.map((platformKey: string) => {
            const account = accounts?.find(a => a.platform === platformKey);
            return {
                tenant_id: tenantId,
                content_id: content.id,
                platform_account_id: account?.id,
                scheduled_at: scheduledTime || new Date().toISOString(),
                status: publishType === 'immediate' ? 'publishing' : 'pending',
            };
        });

        const { data: createdTasks, error: taskError } = await supabase
            .from('publish_tasks')
            .insert(tasksToCreate)
            .select();

        if (taskError) throw taskError;

        return NextResponse.json({
            success: true,
            message: publishType === 'immediate' ? '内容发布指令已下发' : '定时发布任务已创建',
            tasks: createdTasks,
        });
    } catch (error: any) {
        console.error('Publish error:', error);
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
        const { data: tasks, error } = await supabase
            .from('publish_tasks')
            .select(`
                *,
                contents (title)
            `)
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, tasks });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
