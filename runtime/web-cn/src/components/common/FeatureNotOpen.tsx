'use client';

import React from 'react';
import { Button, Result } from 'antd';
import Link from 'next/link';

/** 功能后端尚未开通时的如实说明页：不展示会 404 的表单，也不放「创建」之类点了没用的按钮。 */
export function FeatureNotOpen({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <Result
        status="info"
        title={`${title}暂未开通`}
        subTitle={detail}
        extra={<Link href="/settings"><Button type="primary">返回设置</Button></Link>}
      />
    </div>
  );
}
