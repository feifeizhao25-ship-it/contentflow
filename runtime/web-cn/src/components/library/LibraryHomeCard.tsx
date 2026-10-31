'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { libraryApi, tryLoad, type HomeCardData } from '@/lib/library-live';

/** 工作台首页的一张卡：只有规则库有新增/更新、或者和你的账号很贴近时才出现，其它时候什么都不显示。 */
export function LibraryHomeCard() {
    const [card, setCard] = useState<HomeCardData | null>(null);
    useEffect(() => {
        let alive = true;
        void tryLoad(() => libraryApi.homeCard()).then((r) => alive && setCard(r?.card ?? null));
        return () => {
            alive = false;
        };
    }, []);
    if (!card) return null;
    return (
        <Link href={card.href} className="block rounded-[24px] border border-indigo-100 bg-indigo-50/60 px-5 py-4" data-testid="library-home-card">
            <p className="text-xs font-bold text-indigo-700">规则库 · 为你推荐</p>
            <p className="mt-1 font-bold text-zinc-900 leading-snug">{card.title}</p>
            <p className="mt-1 text-sm text-zinc-600 leading-6 line-clamp-2">{card.description}</p>
            <p className="mt-2 text-xs text-indigo-700">为什么推荐：{card.reason}</p>
        </Link>
    );
}
