import { Injectable, Logger } from '@nestjs/common';
import { PlatformAdapter, PlatformPayload, AdapterResult, PlatformCapabilities } from './adapter.interface';

/**
 * B 站投稿适配器。
 *
 * ⚠️ 尚未接入 B 站开放平台 API。
 *
 * 此前的实现：uploadMedia 打印 "Mock upload" 后返回写死的 av_mock_123；
 * createPost 返回随机 bv_xxx；queryStatus 恒定返回 'published'。
 * 最后一条尤其危险——用户会在界面上看到"已发布"，而稿件从未提交过。
 *
 * 接入步骤（需要 B 站开放平台创作者应用）：
 *   1. OAuth 获取 access_token（BILIBILI_CLIENT_ID / BILIBILI_CLIENT_SECRET）
 *   2. 预上传 /x/vu/client/preupload 获取 upos 地址
 *   3. 分片上传视频并 complete
 *   4. 提交稿件 /x/vu/client/add（需 tid 分区、标题、简介、标签）
 *   5. 轮询 /x/vu/client/view 获取审核状态
 */
@Injectable()
export class BilibiliAdapter implements PlatformAdapter {
    private readonly logger = new Logger(BilibiliAdapter.name);

    platform = 'bilibili';

    /** B 站开放平台凭证齐全时才视为已接入 */
    readonly isLive = Boolean(
        process.env.BILIBILI_CLIENT_ID && process.env.BILIBILI_CLIENT_SECRET,
    );

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

    private notIntegrated<T>(action: string): AdapterResult<T> {
        this.logger.warn(`Bilibili ${action} rejected: adapter is not integrated`);
        return {
            ok: false,
            errorCode: 'ADAPTER_NOT_INTEGRATED',
            retryable: false,
            errorMessage:
                'Bilibili Open Platform API is not integrated. Configure BILIBILI_CLIENT_ID / BILIBILI_CLIENT_SECRET and implement the upload flow.',
            humanMessage: 'B 站投稿通道尚未开通，请先在「账号管理」中完成 B 站授权。',
        };
    }

    async uploadMedia(payload: PlatformPayload): Promise<AdapterResult<{ mediaRefs: any }>> {
        if (!this.isLive) {
            return this.notIntegrated<{ mediaRefs: any }>('uploadMedia');
        }
        // TODO(接入 B 站开放平台): preupload -> 分片上传 -> complete
        return {
            ok: false,
            errorCode: 'NOT_IMPLEMENTED',
            retryable: false,
            humanMessage: 'B 站视频上传正在接入中，暂不可用。',
        };
    }

    async createPost(payload: PlatformPayload): Promise<AdapterResult<{ externalId: string; status: string }>> {
        if (!this.isLive) {
            return this.notIntegrated<{ externalId: string; status: string }>('createPost');
        }
        // TODO(接入 B 站开放平台): 调用 /x/vu/client/add 提交稿件
        return {
            ok: false,
            errorCode: 'NOT_IMPLEMENTED',
            retryable: false,
            humanMessage: 'B 站投稿功能正在接入中，暂不可用。',
        };
    }

    async queryStatus(accountId: string, externalId: string): Promise<AdapterResult<{ status: string }>> {
        if (!this.isLive) {
            return this.notIntegrated<{ status: string }>('queryStatus');
        }
        // TODO(接入 B 站开放平台): 调用 /x/vu/client/view 查询真实审核状态。
        // 绝不能像此前那样无条件返回 'published'。
        return {
            ok: false,
            errorCode: 'NOT_IMPLEMENTED',
            retryable: false,
            humanMessage: 'B 站状态查询正在接入中。',
        };
    }
}
