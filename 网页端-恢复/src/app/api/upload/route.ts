import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'fs/promises';

// 已废弃的 config 导出，Next.js 16 会自动处理 bodyParser
// export const config = {
//     api: {
//         bodyParser: false,
//     },
// };

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: "No file received." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${uuidv4()}_${file.name.replace(/\s/g, '_')}`;

        // Ensure uploads directory exists
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, buffer);

        console.log(`Saved file to ${filepath}`);

        return NextResponse.json({
            success: true,
            url: `/uploads/${filename}`,
            filename: filename
        });

    } catch (error) {
        console.error("Error occurred ", error);
        return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }
}
