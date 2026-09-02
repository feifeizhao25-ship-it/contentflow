import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
    const cookieStore = await cookies();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (process.env.NODE_ENV === 'production' && (!url || !key)) {
        throw new Error('Supabase production configuration is required');
    }

    return createServerClient(
        url || 'https://supabase-development.invalid',
        key || 'development-public-anon-key',
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options });
                    } catch (error) {
                        // The `set` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options });
                    } catch (error) {
                        // The `remove` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
}

export async function getTenantId() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // For local development, if no user is found, we can return a special mock tenant ID
            // to allow testing without needing to log in.
            if (process.env.NODE_ENV === 'development') {
                console.warn('No active session found. Using development mock tenant ID.');
                return '00000000-0000-0000-0000-000000000000';
            }
            return null;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .single();

        return profile?.tenant_id || null;
    } catch (error) {
        console.error('Error fetching tenant ID:', error);
        if (process.env.NODE_ENV === 'development') {
            return '00000000-0000-0000-0000-000000000000';
        }
        return null;
    }
}
