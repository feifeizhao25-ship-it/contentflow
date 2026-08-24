import { NextResponse } from 'next/server';

export async function GET() {
    const results: any = {};

    // Test 1: Google
    try {
        const res = await fetch('https://www.google.com', { method: 'HEAD' });
        results.google = res.status;
    } catch (e: any) {
        results.google = e.message;
    }

    // Test 2: Fal AI (Base URL)
    try {
        const res = await fetch('https://queue.fal.run', { method: 'GET' });
        results.fal_queue = res.status; // 404 is fine, means we connected
    } catch (e: any) {
        results.fal_queue = e.message;
    }

    // Test 3: Fal AI (API)
    try {
        const res = await fetch('https://api.fal.ai', { method: 'GET' });
        results.fal_api = res.status;
    } catch (e: any) {
        results.fal_api = e.message;
    }

    // Test 4: Supabase (if configured)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
        try {
            const res = await fetch(supabaseUrl, { method: 'HEAD' });
            results.supabase = res.status;
        } catch (e: any) {
            results.supabase = e.message;
        }
    }

    // Check keys
    const falKey = process.env.FAL_API_KEY;
    results.fal_key_status = falKey ? `Present (${falKey.length} chars)` : 'Missing';

    return NextResponse.json({
        env: process.env.NODE_ENV,
        results
    });
}
