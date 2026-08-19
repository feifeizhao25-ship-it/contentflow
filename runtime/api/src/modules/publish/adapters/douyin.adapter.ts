import { Injectable, Logger } from '@nestjs/common';
import { PlatformAdapter, PlatformPayload, AdapterResult, PlatformCapabilities } from './adapter.interface';

/**
 * 抖音发布适配器。
 *
 * ⚠️ 尚未接入抖音开放平台 API。
 *
 * 此前 createPost 只打印一行 console.log 就返回 ok:true，
 * 用户在界面上会看到"已准备就绪"，但内容从未离开过本系统。
 * 现在改为：isLive=false，createPost 明确返回失败并说明原因。
 *
 * 接入步骤（需要抖音开放平台已认证的应用）：
 *   1. 走 OAuth 拿到 access_token（DOUYIN_CLIENT_KEY / DOUYIN_CLIENT_SECRET）
 *   2. 视频分片上传 /api/douyin/v1/video/upload/
 *   3. 创建视频 /api/douyin/v1/video/create/
 *   4. 轮询 /api/douyin/v1/video/data/ 获取审核状态
 */
@Injectable()
export class DouyinAdapter implements PlatformAdapter {
    private readonly logger = new Logger(DouyinAdapter.name);

    platform = 'douyin';

    /** 抖音开放平台凭证齐全时才视为已接入 */
    readonly isLive = Boolean(
        process.env.DOUYIN_CLIENT_KEY && process.env.DOUYIN_CLIENT_SECRET,
    );

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
        if (payload.title.length > 55) {
            return { ok: false, humanMessage: '抖音标题不能超过 55 个字符', errorCode: 'TITLE_TOO_LONG' };
        }
        if (!payload.mediaUrls?.length) {
            return { ok: false, humanMessage: '抖音发布需要至少一个视频或图片文件', errorCode: 'MISSING_MEDIA' };
        }
        return { ok: true, data: null };
    }

    async createPost(payload: PlatformPayload): Promise<AdapterResult<{ externalId: string; status: string }>> {
        if (!this.isLive) {
            this.logger.warn(
                `Douyin publish rejected for content ${payload.contentId}: adapter is not integrated`,
            );
            return {
                ok: false,
                errorCode: 'ADAPTER_NOT_INTEGRATED',
                retryable: false,
                errorMessage:
                    'Douyin Open Platform API is not integrated. Configure DOUYIN_CLIENT_KEY / DOUYIN_CLIENT_SECRET and implement the upload flow.',
                humanMessage: '抖音发布通道尚未开通，请先在「账号管理」中完成抖音授权。',
            };
        }

        // TODO(接入抖音开放平台): 实现 OAuth token 获取 -> 分片上传 -> 创建视频
        return {
            ok: false,
            errorCode: 'NOT_IMPLEMENTED',
            retryable: false,
            errorMessage: 'Douyin upload flow is not implemented yet.',
            humanMessage: '抖音发布功能正在接入中，暂不可用。',
        };
    }

    async queryStatus(accountId: string, externalId: string): Promise<AdapterResult<{ status: string }>> {
        if (!this.isLive) {
            return {
                ok: false,
                errorCode: 'ADAPTER_NOT_INTEGRATED',
                retryable: false,
                humanMessage: '抖音发布通道尚未开通，无法查询状态。',
            };
        }
        return {
            ok: false,
            errorCode: 'NOT_IMPLEMENTED',
            retryable: false,
            humanMessage: '抖音状态查询正在接入中。',
        };
    }
}
