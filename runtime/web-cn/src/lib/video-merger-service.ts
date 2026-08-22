/**
 * Video Concatenation Service
 * Supports multiple video merging backends
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import https from 'https';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { resolvePublicMediaPath } from './media-path-guard';
import { AI_MEDIA_METADATA_ARGS } from './ai-content-label';

const streamPipeline = promisify(pipeline);

export interface VideoMergeParams {
    videoUrls: string[];
    outputFormat?: 'mp4' | 'webm';
    aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface VideoMergeResult {
    url: string;
    status: 'completed' | 'processing' | 'failed';
    progress?: number;
}

/**
 * Helper to download file
 */
async function downloadFile(url: string, destPath: string) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(destPath);
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => { });
            reject(err);
        });
    });
}

/**
 * FFmpeg-based video merger
 * Uses local FFmpeg to merge videos
 */
class FFmpegMerger {
    private readonly outputDir = path.join(process.cwd(), 'public', 'generated');

    constructor() {
        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async mergeVideos(params: VideoMergeParams): Promise<VideoMergeResult> {
        console.log('Starting FFmpeg merge execution...');

        const tempFiles: string[] = [];
        const outputFilename = `${randomUUID()}.${params.outputFormat || 'mp4'}`;
        const outputPath = path.join(this.outputDir, outputFilename);
        const publicUrl = `/generated/${outputFilename}`;

        try {
            // 1. Download all videos to temp files
            console.log('Downloading videos...');
            for (let i = 0; i < params.videoUrls.length; i++) {
                const url = params.videoUrls[i];
                const tempFile = path.join(this.outputDir, `temp_${randomUUID()}_${i}.mp4`);
                tempFiles.push(tempFile);

                if (url.startsWith('http')) {
                    await downloadFile(url, tempFile);
                } else if (url.startsWith('/')) {
                    // 路径白名单：只允许 public/ 根目录内的文件。
                    // 旧的「找不到就当绝对路径复制」兜底已删除 ——
                    // 它会把 /etc/passwd 这类任意系统文件拷进公开目录。
                    const localPath = resolvePublicMediaPath(url);
                    if (fs.existsSync(localPath)) {
                        fs.copyFileSync(localPath, tempFile);
                    } else {
                        throw new Error(`Local file not found: ${url}`);
                    }
                } else {
                    throw new Error(`Invalid video URL: ${url}`);
                }
            }

            // 2. Metadata probe (check for audio)
            console.log('Probing video metadata...');
            const hasAudio: boolean[] = await Promise.all(
                tempFiles.map(file => new Promise<boolean>((resolve) => {
                    ffmpeg.ffprobe(file, (err, metadata) => {
                        if (err) {
                            console.warn(`Probe failed for ${file}, assuming no audio`);
                            resolve(false);
                        } else {
                            const hasA = metadata.streams.some(s => s.codec_type === 'audio');
                            resolve(hasA);
                        }
                    });
                }))
            );

            // 3. Merge using ffmpeg complex filter
            console.log('Processing with FFmpeg...');

            return new Promise((resolve, reject) => {
                const command = ffmpeg();

                // Add all inputs
                tempFiles.forEach(f => command.input(f));

                // Determine scale filters
                let width = 1920;
                let height = 1080;
                if (params.aspectRatio === '9:16') {
                    width = 1080;
                    height = 1920;
                } else if (params.aspectRatio === '1:1') {
                    width = 1080;
                    height = 1080;
                }

                const filterComplex: string[] = [];
                const inputs: string[] = [];

                for (let i = 0; i < tempFiles.length; i++) {
                    // Video filter: Scale and Pad
                    filterComplex.push(`[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`);
                    inputs.push(`[v${i}]`);

                    // Audio filter: Handle missing audio with silence
                    if (hasAudio[i]) {
                        filterComplex.push(`[${i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]`);
                    } else {
                        // Generate silence for this segment's duration
                        // We use the input video's duration to limit silence
                        filterComplex.push(`anullsrc=r=44100:cl=stereo,atrim=0:5[a${i}]`); // Default 5s silence for AI clips
                        // Better would be to get duration from probe, but for Minimax 5s is standard.
                    }
                    inputs.push(`[a${i}]`);
                }

                // Concat part
                const concatFilter = `${inputs.join('')}concat=n=${tempFiles.length}:v=1:a=1[v][a]`;
                filterComplex.push(concatFilter);

                command
                    .complexFilter(filterComplex)
                    .map('[v]')
                    .map('[a]')
                    .outputOptions([
                        '-c:v libx264',
                        '-pix_fmt yuv420p',
                        '-c:a ' + (params.outputFormat === 'webm' ? 'libvorbis' : 'aac'),
                        '-movflags +faststart',
                        // AI 生成内容隐式标识（写入文件元数据）
                        ...AI_MEDIA_METADATA_ARGS,
                    ])
                    .on('start', (cmdLine) => {
                        console.log('FFmpeg command:', cmdLine);
                    })
                    .on('error', (err, stdout, stderr) => {
                        console.error('FFmpeg error:', err.message);
                        console.error('FFmpeg stderr:', stderr);
                        reject(err);
                    })
                    .on('end', () => {
                        console.log('FFmpeg processing finished');
                        // Cleanup temp files
                        tempFiles.forEach(f => {
                            if (fs.existsSync(f)) fs.unlinkSync(f);
                        });
                        resolve({
                            url: publicUrl,
                            status: 'completed',
                            progress: 100
                        });
                    })
                    .save(outputPath);
            });

        } catch (error: any) {
            console.error('Merge failed:', error);
            // Cleanup on error
            tempFiles.forEach(f => {
                if (fs.existsSync(f)) fs.unlinkSync(f);
            });
            return {
                url: '',
                status: 'failed',
                progress: 0
            };
        }
    }
}

/**
 * Shotstack-based video merger (Legacy/Cloud)
 */
class ShotstackVideoMerger {
    // ... (Existing implementation if needed, but we prioritize FFmpeg now)
    // Keeping it simple, I'll remove it to reduce clutter as we are moving to local FFmpeg
    // per user instruction to "not do so many functions".
    // If we need it back, we can restore from git history.
    async mergeVideos(): Promise<VideoMergeResult> {
        throw new Error("Shotstack disabled");
    }
}

/**
 * Main video merger service
 */
export class VideoMergerService {
    private ffmpegMerger: FFmpegMerger;

    constructor() {
        this.ffmpegMerger = new FFmpegMerger();
    }

    async mergeVideos(params: VideoMergeParams): Promise<VideoMergeResult> {
        return await this.ffmpegMerger.mergeVideos(params);
    }
}

export const videoMerger = new VideoMergerService();
