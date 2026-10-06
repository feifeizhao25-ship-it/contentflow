'use client';

import React, { useEffect, useState } from 'react';
import { Alert } from 'antd';
import { apiClient } from '@/lib/api-client';

const CJK = /[㐀-鿿]/;

/**
 * 合规规则资料（平台规范、标识办法等）超过时效、未经人工复核时，线上已停止引用。
 * 这里如实告诉用户「合规规则资料需要人工复核」，提醒发布前自行核对平台最新规则。
 * 状态来自 GET /ai/compliance-sources/status；读取失败时不显示（不猜）。
 */
export function ComplianceReviewNotice({ className }: { className?: string }) {
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        apiClient.get<any>('/ai/compliance-sources/status')
            .then((res) => {
                const data = res?.data ?? res;
                if (cancelled || !data?.needsReview) return;
                setNotice(typeof data.notice === 'string' && CJK.test(data.notice) ? data.notice : '合规规则资料需要人工复核');
            })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

    if (!notice) return null;
    return (
        <Alert
            className={className}
            type="warning"
            showIcon
            message="合规规则资料需要人工复核"
            description={notice}
        />
    );
}
