
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const generatedDir = path.join(process.cwd(), 'public', 'generated');

        if (!fs.existsSync(generatedDir)) {
            return NextResponse.json({ files: [] });
        }

        const files = fs.readdirSync(generatedDir)
            .filter(file => file.endsWith('.mp4') || file.endsWith('.webm'))
            .map(file => {
                const stat = fs.statSync(path.join(generatedDir, file));
                return {
                    name: file,
                    url: `/generated/${file}`,
                    createdAt: stat.birthtime,
                    size: stat.size
                };
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Newest first

        return NextResponse.json({ files });

    } catch (error: any) {
        console.error('History API error:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
