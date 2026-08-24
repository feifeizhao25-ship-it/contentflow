'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Progress, Skeleton } from 'antd';
import { apiClient } from '@/lib/api-client';
import { FunnelPlotOutlined } from '@ant-design/icons';

const DEFAULT_STEPS = [
  { event: 'view_overview', label: '进入首页', detail: '查看今日主题卡' },
  { event: 'content_pack_generated', label: '生成内容包', detail: '完成脚本与标题' },
  { event: 'publish_task_created', label: '创建发布任务', detail: '进入排期中心' },
];

interface FunnelStep {
  event: string;
  count: number;
}

const getRangeLabel = (rangeKey: string) => {
  switch (rangeKey) {
    case '24h':
      return '最近 24 小时';
    case '30d':
      return '最近 30 天';
    default:
      return '最近 7 天';
  }
};

const getRangeQuery = (rangeKey: string) => {
  const end = new Date();
  const start = new Date(end.getTime());

  if (rangeKey === '24h') {
    start.setDate(start.getDate() - 1);
  } else if (rangeKey === '30d') {
    start.setDate(start.getDate() - 30);
  } else {
    start.setDate(start.getDate() - 7);
  }

  return `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
};

export const ConversionFunnelCard = ({ rangeKey = '7d' }: { rangeKey?: '24h' | '7d' | '30d' }) => {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<FunnelStep[]>([]);

  useEffect(() => {
    const fetchFunnel = async () => {
      try {
        const res: any = await apiClient.get(`/analytics/funnel${getRangeQuery(rangeKey)}`);
        const data = res?.data?.steps || res?.steps || [];
        setSteps(data);
      } catch {
        setSteps([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFunnel();
  }, [rangeKey]);

  const resolvedSteps = useMemo(() => {
    const map = new Map<string, number>();
    steps.forEach((step) => map.set(step.event, step.count));
    return DEFAULT_STEPS.map((step, index) => {
      const count = map.get(step.event) ?? 0;
      const prev = index === 0 ? count : (map.get(DEFAULT_STEPS[index - 1].event) ?? 0);
      const base = map.get(DEFAULT_STEPS[0].event) ?? 0;
      const stepRate = prev ? Math.round((count / prev) * 100) : 0;
      const totalRate = base ? Math.round((count / base) * 100) : 0;
      return { ...step, count, stepRate, totalRate };
    });
  }, [steps]);

  const completionRate = resolvedSteps.length > 0 ? resolvedSteps[resolvedSteps.length - 1].totalRate : 0;

  return (
    <div className="bg-white/90 border border-amber-100 rounded-[28px] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-amber-600 font-semibold">转化漏斗</div>
          <h3 className="text-xl font-serif text-zinc-900 flex items-center gap-2">
            <FunnelPlotOutlined className="text-amber-500" /> 发布闭环转化
          </h3>
          <p className="text-xs text-zinc-500 mt-1">{getRangeLabel(rangeKey)} | 核心闭环完成率</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">闭环完成率</div>
          <div className="text-2xl font-bold text-[#1f4d4f]">{completionRate}%</div>
        </div>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <div className="space-y-4">
          {resolvedSteps.map((step, index) => (
            <div key={step.event} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{index + 1}. {step.label}</div>
                  <div className="text-[11px] text-zinc-500">{step.detail}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-zinc-900">{step.count}</div>
                  <div className="text-[11px] text-zinc-500">环节转化 {step.stepRate}%</div>
                </div>
              </div>
              <Progress
                percent={step.totalRate}
                showInfo={false}
                strokeColor={index === 0 ? '#1f4d4f' : '#d28b3f'}
                railColor="#f2ede3"
                className="[&_.ant-progress-inner]:!h-2"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
