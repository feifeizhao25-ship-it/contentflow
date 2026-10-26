'use client';

import React, { useEffect, useState } from 'react';
import { Alert } from 'antd';
import { apiClient } from '@/lib/api-client';
import { fetchCurrentUser } from '@/lib/session';

const CJK = /[㐀-鿿]/;

/**
 * 合规资料过期时进入保守模式：生成仍然可用。
 * 所有者和管理员看到复核说明；其他成员只看到“检查会更保守”。
 * 状态来自 GET /ai/compliance-sources/status；读取失败时不显示（不猜）。
 */
export function ComplianceReviewNotice({ className }: { className?: string }) {
    const [view, setView] = useState<{ admin: boolean; text: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            apiClient.get<any>('/ai/compliance-sources/status'),
            fetchCurrentUser(),
        ]).then(([res, session]) => {
            const data = res?.data ?? res;
            if (cancelled || !data?.needsReview) return;
            const role = session?.profile.role;
            const admin = role === 'owner' || role === 'admin';
            const adminText = typeof data.notice === 'string' && CJK.test(data.notice) ? data.notice : '合规规则资料需要人工复核。AI 生成仍然可用。';
            const userText = typeof data.userNotice === 'string' && CJK.test(data.userNotice)
                ? data.userNotice
                : '今天的合规检查会更保守，发布前需要你自行确认。这不是法律意见。';
            setView({ admin, text: admin ? adminText : userText });
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

    if (!view) return null;
    return (
        <Alert
            className={className}
            type="warning"
            showIcon
            message={view.admin ? '合规规则资料需要人工复核' : '合规检查暂时更保守'}
            description={view.text}
        />
    );
}
