'use client';

import React from 'react';
import { Alert } from 'antd';
import { complianceColumns, type ComplianceView } from '@/lib/compliance-view';

/** 三栏：发现的问题、已检查没问题、这一项没有检查。免责声明每次都显示。 */
export function ComplianceResultView({ view }: { view: ComplianceView }) {
  const blocked = view.level === 'violation';
  const risk = view.level === 'risk';
  const columns = complianceColumns(view);
  return (
    <Alert
      data-testid="compliance-result"
      data-level={view.level}
      className="mt-3"
      type={blocked ? 'error' : risk ? 'warning' : 'info'}
      showIcon
      message={blocked ? '明确违规，不能发布' : risk ? '可能有风险，发布前请自行核对' : '这批规则未发现明确违规'}
      description={(
        <div className="space-y-3">
          {view.disclaimer && <p data-testid="compliance-disclaimer" className="m-0">{view.disclaimer}</p>}
          <section>
            <p className="m-0 font-bold">发现的问题</p>
            {columns.found.length ? columns.found.map((line) => <p key={line} className="m-0">{line}</p>) : <p className="m-0">这批已启用的规则没有命中。</p>}
          </section>
          <section>
            <p className="m-0 font-bold">已检查没问题</p>
            <p className="m-0">{columns.checkedSummary}</p>
          </section>
          <section data-testid="compliance-not-checked">
            <p className="m-0 font-bold">这一项没有检查</p>
            {columns.missed.length ? (
              <ul className="mb-0 pl-4">
                {columns.missed.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : <p className="m-0">接口没有返回未检查清单。</p>}
          </section>
        </div>
      )}
    />
  );
}
