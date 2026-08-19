import { Injectable } from '@nestjs/common';
import { PlatformAdapter, PlatformPayload, AdapterResult, PlatformCapabilities } from './adapter.interface';

@Injectable()
export class DouyinAdapter implements PlatformAdapter {
    platform = 'douyin';

    async getCapabilities(accountId: string): Promise<PlatformCapabilities> {
        return {
            publishLevel: 'L4', // 半自动发布
            supports: {
                text: true,
                images: true,
                video: true,
                schedule: false,
                coverUpload: true,
                hashtags: true
            },
        };
    }

    async validate(payload: PlatformPayload): Promise<AdapterResult<null>> {
        if (!payload.title) {
            return { ok: false, humanMessage: '抖音视频标题不能为空', errorCode: 'MISSING_TITLE' };
        }
        return { ok: true, data: null };
    }

    async createPost(payload: PlatformPayload): Promise<AdapterResult<{ externalId: string; status: string }>> {
        // L4 通常返回一个 deeplink 或引导 URL
        console.log(`[DouyinAdapter] Preparing L4 publish bundle for: ${payload.title}`);
        return {
            ok: true,
            data: {
                externalId: 'awaiting_confirmation',
                status: 'awaiting_user_confirm'
            },
            humanMessage: '内容已准备就绪，请在抖音端进行最后的发布确认。'
        };
    }
}
