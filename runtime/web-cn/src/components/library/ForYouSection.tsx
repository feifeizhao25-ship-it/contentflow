'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Switch, Tag } from 'antd';
import {
    BADGE_TEXT,
    libraryApi,
    topicStateText,
    tryLoad,
    type FeedItem,
    type FeedResponse,
    type TopicState,
} from '@/lib/library-live';

/** 最近一次「看过」只在离开页面时记，这样本次打开页面时「上次来访后」的标记不会被自己抹掉。 */
export function useRecordVisit(active: boolean) {
    const done = useRef(false);
    useEffect(() => {
        if (!active) return;
        const send = () => {
            if (done.current) return;
            done.current = true;
            void tryLoad(() => libraryApi.visit());
        };
        const onHide = () => document.visibilityState === 'hidden' && send();
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', send);
        return () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', send);
            send();
        };
    }, [active]);
}

export function ForYouSection() {
    const [feed, setFeed] = useState<FeedResponse | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        const f = await tryLoad(() => libraryApi.feed());
        if (f) {
            setFeed(f);
            setStatus('ready');
        } else {
            setStatus('failed');
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    useRecordVisit(status === 'ready' && feed?.enabled === true);

    const change = async (body: Parameters<typeof libraryApi.setPreferences>[0]) => {
        setBusy(true);
        await tryLoad(() => libraryApi.setPreferences(body));
        await load();
        setBusy(false);
    };

    if (status === 'loading') {
        return (
            <section className="mt-6 glass-card p-5" data-testid="foryou-loading" aria-busy="true">
                <p className="text-sm text-zinc-500">正在为你挑选…</p>
            </section>
        );
    }
    if (status === 'failed' || !feed) {
        return (
            <section className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600" data-testid="foryou-unavailable">
                「为你推荐」暂时不可用，下面的规则库可以正常查看。
            </section>
        );
    }

    return (
        <section className="mt-6" data-testid="foryou" aria-label="为你推荐">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">为你推荐</h2>
                <Button size="small" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid="foryou-settings-toggle">
                    推荐设置
                </Button>
            </div>

            {open && (
                <div className="glass-card p-4 mt-3" data-testid="foryou-settings">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="font-bold text-sm">个性化推荐</p>
                            <p className="text-xs text-zinc-500 mt-1 leading-5">
                                只用你绑定的平台、人设里写的账号定位、你关注的主题，以及你在这里读过的内容。关闭后不再推荐，也不再记录你读过什么。
                            </p>
                        </div>
                        <Switch
                            checked={feed.enabled}
                            disabled={busy}
                            onChange={(v) => void change({ enabled: v })}
                            aria-label="个性化推荐开关"
                            data-testid="foryou-switch"
                        />
                    </div>
                    {feed.enabled && (
                        <ul className="mt-4 divide-y divide-zinc-100" aria-label="主题">
                            {(feed.topics ?? []).map((t) => (
                                <TopicRow key={t.id} t={t} busy={busy} onChange={change} />
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {!feed.enabled ? (
                <div className="glass-card p-5 mt-3 text-sm text-zinc-600" data-testid="foryou-off">
                    个性化推荐已关闭。你仍然可以在下面浏览和搜索全部规则。
                    <Button size="small" className="ml-3" onClick={() => void change({ enabled: true })} data-testid="foryou-turn-on">
                        重新打开
                    </Button>
                </div>
            ) : feed.items.length === 0 ? (
                <div className="glass-card p-5 mt-3 text-sm text-zinc-600" data-testid="foryou-empty">
                    暂时没有合适的推荐。
                </div>
            ) : (
                <>
                    <div className="grid md:grid-cols-2 gap-4 mt-3">
                        {feed.items.map((i) => (
                            <FeedCard key={i.id} item={i} />
                        ))}
                    </div>
                    {feed.note && <p className="mt-3 text-xs text-zinc-400 leading-5">{feed.note}</p>}
                </>
            )}
        </section>
    );
}

function TopicRow({ t, busy, onChange }: { t: TopicState; busy: boolean; onChange: (b: { follow?: string[]; unfollow?: string[]; mute?: string[]; unmute?: string[] }) => Promise<void> }) {
    return (
        <li className="py-2 flex items-center justify-between gap-3" data-testid={`topic-${t.id}`}>
            <span className="text-sm">
                {t.name} <span className="text-xs text-zinc-400 ml-1">{topicStateText(t)}</span>
            </span>
            <span className="flex gap-2">
                {t.followed ? (
                    <Button size="small" disabled={busy} data-testid={`unfollow-${t.id}`} onClick={() => void onChange({ unfollow: [t.id] })}>
                        取消关注
                    </Button>
                ) : (
                    <Button size="small" disabled={busy} data-testid={`follow-${t.id}`} onClick={() => void onChange({ follow: [t.id] })}>
                        关注
                    </Button>
                )}
                {t.muted ? (
                    <Button size="small" disabled={busy} data-testid={`unmute-${t.id}`} onClick={() => void onChange({ unmute: [t.id] })}>
                        恢复推荐
                    </Button>
                ) : (
                    <Button size="small" disabled={busy} data-testid={`mute-${t.id}`} onClick={() => void onChange({ mute: [t.id] })}>
                        不再推荐
                    </Button>
                )}
            </span>
        </li>
    );
}

function FeedCard({ item }: { item: FeedItem }) {
    return (
        <Link
            href={`/rules/${item.id}`}
            className="glass-card p-5 block"
            data-testid="foryou-card"
            onClick={() => void tryLoad(() => libraryApi.opened(item.id))}
        >
            <div className="flex flex-wrap items-center gap-2">
                <Tag color="geekblue">{item.topic_name || item.category}</Tag>
                {item.badge && (
                    <Tag color={item.badge === 'updated' ? 'volcano' : 'green'} data-testid="foryou-badge">
                        {BADGE_TEXT[item.badge]}
                    </Tag>
                )}
                {item.badges.map((b) => (
                    <Tag key={b.kind} color={b.kind === 'updated' ? 'orange' : 'default'}>
                        {b.text}
                    </Tag>
                ))}
            </div>
            <h3 className="font-bold text-base mt-3 leading-snug">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{item.summary}</p>
            {item.change_note && (
                <p className="mt-2 text-sm leading-6 rounded-lg bg-orange-50 text-orange-900 px-3 py-2" data-testid="foryou-change-note">
                    更新说明：{item.change_note}
                </p>
            )}
            <p className="mt-3 text-xs text-indigo-700 leading-5" data-testid="foryou-reason">
                为什么推荐：{item.reason}
            </p>
        </Link>
    );
}
