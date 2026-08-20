'use client';

import { useEffect } from 'react';
import { Button } from 'antd';
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/20 blur-[120px] rounded-full point-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full point-events-none" />

            <div className="glass-card p-12 rounded-3xl border border-white/10 text-center max-w-md w-full relative z-10 backdrop-blur-xl bg-zinc-900/40">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                    <span className="text-4xl">⚠️</span>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">页面暂时无法加载</h2>
                <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
                    系统遇到意外错误，请重试或返回内容工作室。
                </p>

                <div className="flex flex-col gap-3">
                    <Button
                        type="primary"
                        size="large"
                        icon={<ReloadOutlined />}
                        onClick={reset}
                        className="!rounded-xl !bg-white !text-black hover:!bg-zinc-200 !font-bold !h-12 border-none"
                    >
                        重试
                    </Button>
                    <Button
                        type="default"
                        size="large"
                        icon={<HomeOutlined />}
                        href="/studio"
                        className="!rounded-xl !text-zinc-400 hover:!text-white hover:!bg-white/5 !h-12 !border-white/5"
                    >
                        返回内容工作室
                    </Button>
                </div>

                {error.digest && (
                    <div className="mt-8 pt-4 border-t border-white/5">
                        <p className="text-[10px] text-zinc-600 font-mono">
                            错误编号：{error.digest}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
