'use client';

import React, { useEffect, useState } from 'react';
import { Alert } from 'antd';
import { apiClient } from '@/lib/api-client';
import { fetchCurrentUser } from '@/lib/session';

const CJK = /[㐀-鿿]/;

const STATE_TEXT: Record<string, string> = {
    unreviewed: '尚未人工审核',
    stale: '已超过核对期限',
    invalid: '字段无法读取',
    due_soon: '即将到期',
    current: '已核对',
};

type SourceRow = { name: string; lastCheckedAt?: string | null; state?: string; sourceUrl?: string | null; publishedAt?: string | null };

/**
 * 合规资料过期或尚未人工审核时进入保守模式：生成仍然可用。
 * 所有者和管理员看到真实原因、规则版本、核对日期和出处；其他成员只看到短提示。
 * 状态来自 GET /ai/compliance-sources/status；读取失败时不显示（不猜）。
 */
export function ComplianceReviewNotice({ className }: { className?: string }) {
    const [view, setView] = useState<{ admin: boolean; text: string; version: string; sources: SourceRow[] } | null>(null);

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
            const sources = Array.isArray(data.sources) ? data.sources.filter((item: unknown) => item && typeof item === 'object') as SourceRow[] : [];
            setView({
                admin,
                text: admin ? adminText : userText,
                version: typeof data.ruleSetVersion === 'string' ? data.ruleSetVersion : '',
                sources,
            });
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

    if (!view) return null;
    return (
        <Alert
            className={className}
            type="warning"
            showIcon
            message={view.admin ? '规则资料状态' : '合规检查暂时更保守'}
            description={(
                <div>
                    <p className="m-0">{view.text}</p>
                    {view.admin && view.version ? <p className="mb-0 mt-2">规则版本：{view.version}</p> : null}
                    {view.admin && view.sources.length > 0 ? (
                        <ul className="mb-0 mt-2 pl-4">
                            {view.sources.map((source) => (
                                <li key={`${source.name}-${source.lastCheckedAt ?? ''}`}>
                                    {source.name}
                                    {' · '}
                                    {STATE_TEXT[source.state ?? ''] ?? '状态未知'}
                                    {source.publishedAt ? ` · 生效日期 ${source.publishedAt.slice(0, 10)}` : ''}
                                    {source.lastCheckedAt ? ` · 核对日期 ${source.lastCheckedAt.slice(0, 10)}` : ' · 还没有核对日期'}
                                    {source.sourceUrl ? <> · <a href={source.sourceUrl}>出处</a></> : null}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            )}
        />
    );
}
