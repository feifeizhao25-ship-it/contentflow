'use client';

import React from 'react';
import { Empty, Button } from 'antd';
import { PlusOutlined, InboxOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';

interface EmptyStateProps {
    title: string;
    description: string;
    actionText?: string;
    onAction?: () => void;
    icon?: React.ReactNode;
    image?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    actionText,
    onAction,
    icon,
    image
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center p-12 bg-white/50 dark:bg-zinc-900/30 rounded-3xl border border-zinc-100 dark:border-zinc-800 text-center"
        >
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 dark:text-indigo-400">
                {icon || <InboxOutlined className="text-3xl" />}
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{title}</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xs mb-8">
                {description}
            </p>
            {actionText && (
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    size="large"
                    onClick={onAction}
                    className="bg-indigo-600 h-12 rounded-xl px-8 font-bold shadow-lg shadow-indigo-200"
                >
                    {actionText}
                </Button>
            )}
        </motion.div>
    );
};
