import { Injectable } from '@nestjs/common';
import { PlatformAdapter, PlatformPayload, AdapterResult, PlatformCapabilities } from './adapter.interface';

@Injectable()
export class BilibiliAdapter implements PlatformAdapter {
    platform = 'bilibili';

    async getCapabilities(accountId: string): Promise<PlatformCapabilities> {
        return {
            publishLevel: 'L5',
            supports: {
                text: true,
                images: false,
                video: true,
                schedule: true,
                coverUpload: true,
                hashtags: true
            },
        };
    }

    async validate(payload: PlatformPayload): Promise<AdapterResult<null>> {
        if (!payload.title) {
            return { ok: false, humanMessage: '标题是必填项 (Title is required)', errorCode: 'MISSING_TITLE' };
        }
        if (payload.title.length > 80) {
            return { ok: false, humanMessage: '标题长度不能超过 80 个字符', errorCode: 'TITLE_TOO_LONG' };
        }
        if (!payload.extra?.tid) {
            return { ok: false, humanMessage: '请选择分区 (Missing TID)', errorCode: 'MISSING_TID' };
        }
        if (!payload.mediaUrls?.length) {
            return { ok: false, humanMessage: '视频稿件必须包含视频文件', errorCode: 'MISSING_VIDEO' };
        }
        return { ok: true, data: null };
    }

    async uploadMedia(payload: PlatformPayload): Promise<AdapterResult<{ mediaRefs: any }>> {
        // 模拟 B 站上传流程
        console.log(`[BilibiliAdapter] Mock upload media for ${payload.contentId}`);
        return {
            ok: true,
            data: {
                mediaRefs: {
                    video_id: 'av_mock_123',
                    cid: 'mock_cid_456'
                }
            }
        };
    }

    async createPost(payload: PlatformPayload): Promise<AdapterResult<{ externalId: string; status: string }>> {
        console.log(`[BilibiliAdapter] Creating post: ${payload.title}`);
        // 模拟提交
        return {
            ok: true,
            data: {
                externalId: `bv_${Math.random().toString(36).substr(2, 10)}`,
                status: 'reviewing'
            }
        };
    }

    async queryStatus(accountId: string, externalId: string): Promise<AdapterResult<{ status: string }>> {
        return { ok: true, data: { status: 'published' } };
    }
}
