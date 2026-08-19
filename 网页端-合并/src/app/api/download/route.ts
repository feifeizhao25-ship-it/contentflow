import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    const filename = request.nextUrl.searchParams.get('filename') || 'download';

    if (!url) {
        return new NextResponse('Missing URL', { status: 400 });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

        const blob = await response.blob();
        const headers = new Headers();
        headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
        headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

        return new NextResponse(blob, {
            status: 200,
            headers,
        });
    } catch (error: any) {
        console.error('Download proxy error:', error);
        return new NextResponse(`Download failed: ${error.message}`, { status: 500 });
    }
}
