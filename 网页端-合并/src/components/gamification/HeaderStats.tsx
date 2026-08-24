'use client';

import React, { useEffect } from 'react';
import { useUserStore } from '@/store/appStore';
import { useGamificationStore } from '@/store/gamificationStore';
import { FireFilled } from '@ant-design/icons';
import { Tooltip, Progress } from 'antd';
import { motion } from 'framer-motion';

export const HeaderStats = () => {
    const { user } = useUserStore();
    const { level, xp, nextLevelXp, streak, fetchStatus } = useGamificationStore();

    useEffect(() => {
        if (user?.id) {
            fetchStatus(user.id);
        }
    }, [user?.id, fetchStatus]);

    const progressPercent = Math.min((xp / nextLevelXp) * 100, 100);

    return (
        <div className="flex items-center gap-3 bg-white/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-amber-100 shadow-sm">
            {/* Level Badge */}
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[#1f4d4f] to-[#d28b3f] text-white text-[10px] font-bold shadow-sm">
                LV{level}
            </div>

            {/* XP Bar */}
            <div className="flex flex-col w-24 gap-0.5">
                <div className="flex justify-between text-[10px] text-zinc-500 font-bold leading-none">
                    <span>Exp</span>
                    <span>{xp}/{nextLevelXp}</span>
                </div>
                <Progress
                    percent={progressPercent}
                    showInfo={false}
                    strokeColor={{ '0%': '#1f4d4f', '100%': '#d28b3f' }}
                    railColor="rgba(31, 77, 79, 0.08)"
                    size="small"
                    className="!m-0 [&_.ant-progress-inner]:!h-1.5"
                />
            </div>

            {/* Streak */}
            <Tooltip title={`连续 ${streak} 天创作`}>
                <div className="flex items-center gap-1 pl-2 border-l border-amber-100">
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
                    >
                        <FireFilled className="text-orange-500 text-sm" />
                    </motion.div>
                    <span className="text-xs font-black text-zinc-700">{streak}</span>
                </div>
            </Tooltip>
        </div>
    );
};
