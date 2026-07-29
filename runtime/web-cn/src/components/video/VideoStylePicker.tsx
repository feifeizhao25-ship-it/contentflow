'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Tooltip, Tag } from 'antd';
import {
    VideoStyleId,
    VideoStylePreset,
    getStylePreset,
    getTrendingStyles,
    getAllStyles
} from '@/lib/video-style-presets';

interface VideoStylePickerProps {
    value?: VideoStyleId;
    onChange?: (style: VideoStyleId) => void;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    platform?: string;
    size?: 'small' | 'medium' | 'large';
    showDescription?: boolean;
    className?: string;
}

// 风格展示组件
export function VideoStyleCard({
    style,
    selected,
    onClick,
    size = 'medium',
    showDescription = true
}: {
    style: VideoStylePreset;
    selected: boolean;
    onClick: () => void;
    size?: 'small' | 'medium' | 'large';
    showDescription?: boolean;
}) {
    const sizeClasses = {
        small: 'p-2 text-xs',
        medium: 'p-3 text-sm',
        large: 'p-4 text-base'
    };

    const iconSizes = {
        small: 'text-xl',
        medium: 'text-2xl',
        large: 'text-3xl'
    };

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={clsx(
                'rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden',
                sizeClasses[size],
                selected
                    ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-100'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md'
            )}
        >
            {/* 选中指示器 */}
            {selected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                </div>
            )}

            <div className="flex items-center gap-2 mb-1">
                <span className={iconSizes[size]}>{style.icon}</span>
                <span className="font-bold text-zinc-800">{style.nameCn}</span>
            </div>

            {showDescription && (
                <p className="text-zinc-500 text-xs leading-relaxed">
                    {style.description}
                </p>
            )}

            {/* 平台兼容标签 */}
            {size !== 'small' && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {style.aspectRatios.slice(0, 2).map(ratio => (
                        <Tag
                            key={ratio}
                            className="text-[10px] px-1 py-0 m-0"
                            color={ratio === '9:16' ? 'purple' : ratio === '16:9' ? 'blue' : 'green'}
                        >
                            {ratio}
                        </Tag>
                    ))}
                </div>
            )}
        </motion.div>
    );
}

// 风格预览弹窗
export function StylePreviewModal({
    style,
    visible,
    onClose
}: {
    style: VideoStylePreset | null;
    visible: boolean;
    onClose: () => void;
}) {
    if (!style) return null;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-4xl">{style.icon}</span>
                            <div>
                                <h3 className="text-xl font-bold text-zinc-900">{style.nameCn}</h3>
                                <p className="text-sm text-zinc-500">{style.name}</p>
                            </div>
                        </div>

                        <p className="text-zinc-600 mb-4">{style.description}</p>

                        <div className="space-y-3">
                            <div>
                                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">正向提示词</h4>
                                <div className="bg-zinc-50 rounded-lg p-3 text-xs text-zinc-700 font-mono break-all">
                                    {style.promptTemplate.replace('{prompt}', '示例场景描述')}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">负面提示词</h4>
                                <div className="bg-red-50 rounded-lg p-3 text-xs text-red-700 font-mono break-all">
                                    {style.negativePrompt}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">支持尺寸</h4>
                                <div className="flex gap-2">
                                    {style.aspectRatios.map(ratio => (
                                        <Tag key={ratio} color="blue">{ratio}</Tag>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                        >
                            确定
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// 主组件：风格选择器
export default function VideoStylePicker({
    value,
    onChange,
    aspectRatio = '16:9',
    platform,
    size = 'medium',
    showDescription = true,
    className = ''
}: VideoStylePickerProps) {
    const [previewStyle, setPreviewStyle] = React.useState<VideoStylePreset | null>(null);
    const [showAll, setShowAll] = React.useState(false);

    // 获取可用风格列表
    const allStyles = getAllStyles();
    const trendingStyles = getTrendingStyles();
    
    const displayStyles = showAll ? allStyles : trendingStyles;

    // 根据尺寸过滤
    const filteredStyles = displayStyles.filter(style =>
        style.aspectRatios.includes(aspectRatio)
    );

    // 防止列表为空
    const finalStyles = filteredStyles.length > 0 ? filteredStyles : displayStyles;

    return (
        <div className={className}>
            {/* 头部 */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-zinc-700">视频风格</h3>
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                    {showAll ? '收起' : '查看全部'}
                </button>
            </div>

            {/* 风格网格 */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {finalStyles.map(style => (
                    <Tooltip
                        key={style.id}
                        title={
                            <div>
                                <div className="font-medium">{style.nameCn}</div>
                                <div className="text-xs opacity-80">{style.description}</div>
                            </div>
                        }
                        placement="top"
                    >
                        <div>
                            <VideoStyleCard
                                style={style}
                                selected={value === style.id}
                                onClick={() => onChange?.(style.id)}
                                size={size}
                                showDescription={showDescription}
                            />
                        </div>
                    </Tooltip>
                ))}
            </div>

            {/* 预览弹窗 */}
            <StylePreviewModal
                style={previewStyle}
                visible={!!previewStyle}
                onClose={() => setPreviewStyle(null)}
            />
        </div>
    );
}

// 简化的风格选择按钮（用于紧凑空间）
export function StyleSelectButton({
    value,
    onChange,
    aspectRatio = '16:9'
}: {
    value?: VideoStyleId;
    onChange?: (style: VideoStyleId) => void;
    aspectRatio?: '16:9' | '9:16' | '1:1';
}) {
    const currentStyle = value ? getStylePreset(value) : null;
    const trendingStyles = getTrendingStyles().filter(s =>
        s.aspectRatios.includes(aspectRatio)
    );

    return (
        <div className="flex items-center gap-2">
            {currentStyle && value ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-200">
                    <span>{currentStyle.icon}</span>
                    <span className="text-sm font-medium text-indigo-700">{currentStyle.nameCn}</span>
                    <button
                        onClick={() => onChange?.(value)}
                        className="ml-1 text-indigo-400 hover:text-indigo-600"
                    >
                        ×
                    </button>
                </div>
            ) : (
                <span className="text-sm text-zinc-400">选择风格</span>
            )}

            <select
                value={value || ''}
                onChange={e => onChange?.(e.target.value as VideoStyleId)}
                className="text-sm border border-zinc-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
                <option value="">选择风格</option>
                {trendingStyles.map(style => (
                    <option key={style.id} value={style.id}>
                        {style.icon} {style.nameCn}
                    </option>
                ))}
            </select>
        </div>
    );
}
