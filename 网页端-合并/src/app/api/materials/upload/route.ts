import { NextRequest, NextResponse } from 'next/server';
import { createClient, getTenantId } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as string || 'image';

        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }

        const tenantId = await getTenantId();
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();

        // 2. Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${tenantId}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('materials')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error('Failed to upload to storage: ' + uploadError.message);
        }

        // 3. Get Public URL
        const { data: urlData } = supabase.storage
            .from('materials')
            .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        // 4. Save to contents table (as a material)
        const { data: content, error: dbError } = await supabase
            .from('contents')
            .insert({
                tenant_id: tenantId,
                title: file.name,
                content_type: type === 'image' ? 'image' : 'video',
                media_urls: [publicUrl],
                status: 'approved',
                source: 'manual',
            })
            .select()
            .single();

        if (dbError) throw dbError;

        return NextResponse.json({
            success: true,
            material: {
                id: content.id,
                name: content.title,
                url: publicUrl,
                type: content.content_type,
                size: (file.size / 1024).toFixed(1) + ' KB',
                updatedAt: content.created_at,
                tags: [],
            }
        });
    } catch (error: any) {
        console.error('Material upload error:', error);
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
        const { data: contents, error } = await supabase
            .from('contents')
            .select('*')
            .eq('tenant_id', tenantId)
            .in('content_type', ['image', 'video'])
            .order('created_at', { ascending: false });

        if (error) throw error;

        const materials = contents.map((c: any) => ({
            id: c.id,
            name: c.title,
            url: c.media_urls?.[0] || '',
            type: c.content_type,
            size: '未知',
            updatedAt: c.created_at,
            tags: c.tags || [],
            favorite: false,
        }));

        return NextResponse.json({ success: true, materials });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
