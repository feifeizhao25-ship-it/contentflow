export type PublishLevel = 'L2' | 'L3' | 'L4' | 'L5';

export interface PlatformCapabilities {
    publishLevel: PublishLevel;
    supports: {
        text: boolean;
        images: boolean;
        video: boolean;
        schedule: boolean;
        coverUpload: boolean;
        hashtags: boolean;
    };
}

export interface PlatformPayload {
    platform: string;
    contentId: string;
    title?: string;
    body?: string;
    bodyHtml?: string;
    hashtags?: string[];
    coverUrl?: string;
    mediaUrls?: string[];
    extra?: Record<string, any>; // 平台特有字段
}

export interface AdapterResult<T> {
    ok: boolean;
    data?: T;
    errorCode?: string;
    errorMessage?: string;
    retryable?: boolean;
    humanMessage?: string; // 给前端的人话
}

export interface PlatformAdapter {
    platform: string;

    /**
     * 该适配器是否已完成真实平台对接。
     *
     * false 表示尚未接入开放平台 API，调用 createPost 不会真的把内容发出去。
     * PublishService 必须据此拒绝发布请求，而不是回报成功——
     * 让用户以为已发布却什么都没发生，比直接报错危害大得多。
     */
    readonly isLive: boolean;

    getCapabilities(accountId: string): Promise<PlatformCapabilities>;

    validate(payload: PlatformPayload): Promise<AdapterResult<null>>;

    // 上传媒体（如果平台需要先上传返回 media_id / upload_token）
    uploadMedia?(payload: PlatformPayload): Promise<AdapterResult<{ mediaRefs: any }>>;

    // 提交发布/投稿
    createPost(payload: PlatformPayload): Promise<AdapterResult<{ externalId: string; status: string }>>;

    // 查询审核/发布状态
    queryStatus?(accountId: string, externalId: string): Promise<AdapterResult<{ status: string }>>;
}
