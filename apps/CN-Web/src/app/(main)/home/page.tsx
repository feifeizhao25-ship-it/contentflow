'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/StatusStates';
import NewUserDashboard from '@/components/dashboard/NewUserDashboard';
import ActiveUserDashboard from '@/components/dashboard/ActiveUserDashboard';
import ReturningDashboard from '@/components/dashboard/ReturningDashboard';
import ProUserDashboard from '@/components/dashboard/ProUserDashboard';
import type { UserSegment, UserMetricsResponse } from '@/components/dashboard/types';
import { FadeInCard } from '@/components/ui/Animations';
import { getDashboardConfig, inferStage, inferActivity, type UserPersona } from '@/lib/persona/UserPersonaEngine';

const stageLabels: Record<UserPersona['stage'], string> = {
  newcomer: '新手期',
  growing: '成长期',
  mature: '成熟期',
  expert: '专家期',
};

const nicheLabels: Record<UserPersona['niche'], string> = {
  tech: '科技',
  beauty: '美妆',
  education: '教育',
  food: '美食',
  finance: '财经',
  gaming: '游戏',
  fashion: '时尚',
  b2b: '企业服务',
  lifestyle: '生活方式',
  entertainment: '娱乐',
};
export default function HomePage() {
  const [segment, setSegment] = useState<UserSegment | null>(null);
  const [persona, setPersona] = useState<UserPersona | null>(null);
  const [metrics, setMetrics] = useState<UserMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);

        setSegment(segData?.data?.segment ?? null);
        setMetrics(metData?.data || null);

        // Determine Pro status from tags or user metadata
        const hasProTag = metData?.data?.tags?.includes('pro') || metData?.data?.tags?.includes('vip');
        setIsPro(hasProTag || false);

        const profile = segData?.data ?? {};
        const metricData = metData?.data ?? {};
        const niche = profile.niche ?? metricData.niche ?? localStorage.getItem('userNiche') ?? 'lifestyle';
        const daysSinceSignup = Number(profile.daysSinceSignup ?? metricData.daysSinceSignup ?? 0);
        const totalContent = Number(profile.totalContentCreated ?? metricData.totalContentCreated ?? metricData.totalContent ?? metricData.content_count ?? 0);
        const platformsConnected = Number(profile.platformsConnected ?? metricData.platformsConnected ?? 0);
        const lastActiveDays = Number(profile.lastActiveDays ?? metricData.lastActiveDays ?? 0);
        const stage = inferStage({
          daysSinceSignup,
          totalContentCreated: totalContent,
          platformsConnected,
        });
        const activity = inferActivity(lastActiveDays);

        setPersona({
          stage,
          niche: niche as UserPersona['niche'],
          activity,
          region: 'CN',
          membershipTier: Number(profile.membershipTier ?? metricData.membershipTier ?? (hasProTag ? 3 : 1)),
          daysSinceSignup,
          totalContentCreated: totalContent,
          platformsConnected,
          lastActiveDays,
        });
      } catch {
        setSegment(null);
        setPersona(null);
        setMetrics(null);
        setIsPro(false);
      } finally {
    loadDashboard();
  }, []);

  const dashboardCards = useMemo(() => {
    if (!persona) return [];
    return getDashboardConfig(persona);
  }, [persona]);

  const dashboardView = useMemo(() => {
    if (isPro) {
      return <ProUserDashboard metrics={metrics || undefined} isPro />;
    }

    switch (segment) {
      case 'new':
        return <NewUserDashboard metrics={metrics || undefined} />;
      case 'dormant':
      case 'churned':
        return <ReturningDashboard metrics={metrics || undefined} />;
      case 'active':
        return <ActiveUserDashboard metrics={metrics || undefined} />;
      default:
        return <NewUserDashboard metrics={metrics || undefined} />;
    }
  }, [isPro, metrics, segment]);

  return (
    <div className="space-y-4">
      {dashboardCards.length > 0 && persona && (
        <FadeInCard className="px-6 pt-6">
          <div className="rounded-2xl border border-cyan-100/60 bg-gradient-to-br from-cyan-50 via-white to-orange-50 p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
              <div>
                <div className="text-sm font-bold text-cyan-700">为你推荐</div>
                <div className="text-xs text-gray-500 mt-1">
                  根据{nicheLabels[persona.niche] ?? '内容'}领域、{stageLabels[persona.stage]}和最近活跃行为调整
                </div>
              </div>
              <div className="text-xs text-gray-500">每天登录后，重点卡片会随进度变化</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {dashboardCards.slice(0, 4).map((card) => (
                <div key={card.id} className="group rounded-xl border border-white bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="text-sm font-bold text-gray-900">{card.titleZh}</div>
                  <div className="text-xs text-gray-500 mt-1">{card.subtitleZh}</div>
                  <div className="text-xs text-cyan-700 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {card.reasonZh}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeInCard>
      )}
      {dashboardView}
    </div>
  );
}
