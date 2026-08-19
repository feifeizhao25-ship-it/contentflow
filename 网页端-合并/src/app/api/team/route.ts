import { NextRequest, NextResponse } from 'next/server';
import { createClient, getTenantId } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    try {
        const tenantId = await getTenantId();
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();
        const { data: members, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, members });
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
        const { email, role, name } = body;

        if (!email || !role) {
            return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Check if user already exists in this tenant
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('email', email)
            .single();

        if (existingUser) {
            return NextResponse.json({ error: 'User already in team' }, { status: 400 });
        }

        // 2. Mock Invitation: Create a profile entry
        // In a real app, you'd use supabase.auth.admin.inviteUserByEmail()
        const { data: newMember, error: inviteError } = await supabase
            .from('profiles')
            .insert({
                tenant_id: tenantId,
                email,
                role,
                name: name || email.split('@')[0],
                status: 'inactive', // Pending invitation
            })
            .select()
            .single();

        if (inviteError) throw inviteError;

        return NextResponse.json({ success: true, member: newMember });
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
            .from('profiles')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .neq('role', 'owner'); // Cannot remove owner

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
