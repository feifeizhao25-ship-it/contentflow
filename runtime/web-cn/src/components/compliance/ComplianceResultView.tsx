'use client';

import React from 'react';
import { Alert } from 'antd';
import type { ComplianceView } from '@/lib/compliance-view';

/** 三级结果：明确违规、可能有风险、未发现。免责声明每次都显示。 */
export function ComplianceResultView({ view }: { view: ComplianceView }) {
  const blocked = view.level === 'violation';
  const risk = view.level === 'risk';
  return (
    <Alert
      data-testid="compliance-result"
      data-level={view.level}
      className="mt-3"
      type={blocked ? 'error' : risk ? 'warning' : 'info'}
      showIcon
      message={blocked ? '明确违规，不能发布' : risk ? '可能有风险，发布前请自行核对' : '这批规则未发现明确违规'}
      description={(
        <div className="space-y-2">
          {view.disclaimer && <p data-testid="compliance-disclaimer" className="m-0">{view.disclaimer}</p>}
          {view.hits.map((hit, index) => (
            <p key={`${hit.ruleId}-${index}`} className="m-0">
              {hit.severity === 'block' ? '拦截' : '风险'}：{hit.reason}
            </p>
          ))}
        </div>
      )}
    />
  );
}
