'use client';

import React, { useState } from 'react';
import { ConclusionHero } from '@/components/analytics/ConclusionHero';
import { ContentRankList } from '@/components/analytics/ContentRankList';
import { ReplayPanel } from '@/components/analytics/ReplayPanel';

export default function AnalyticsPage() {
    const [selectedId, setSelectedId] = useState<string | null>('1');

    return (
        <div className="h-[calc(100vh-64px)] p-6 bg-zinc-50 flex flex-col gap-6 overflow-y-auto md:overflow-hidden">
            {/* 1. Hero Section */}
            <div className="flex-none">
                <ConclusionHero />
            </div>

            {/* 2. Main Content Area */}
            <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6">
                {/* Left List */}
                <div className="flex-none md:h-full shadow-sm">
                    <ContentRankList selectedId={selectedId} onSelect={setSelectedId} />
                </div>

                {/* Right Replay Panel */}
                <div className="flex-1 md:h-full shadow-sm pb-10 md:pb-0">
                    <ReplayPanel selectedId={selectedId} />
                </div>
            </div>
        </div>
    );
}
