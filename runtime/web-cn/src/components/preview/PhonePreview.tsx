import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Avatar } from 'antd';
import { HeartOutlined, StarOutlined, MessageOutlined, ShareAltOutlined } from '@ant-design/icons';

interface PhonePreviewProps {
    platform: string;
    content: string; // Plain text or HTML? We'll assume plain text or simple markdown for preview
    images: string[];
    title?: string;
    authorName?: string;
    authorAvatar?: string;
}

export const PhonePreview: React.FC<PhonePreviewProps> = ({
    platform,
    content,
    images,
    title,
    authorName = '分发侠',
    authorAvatar
}) => {
    // Platform specific styles
    const getPlatformStyle = () => {
        switch (platform) {
            case 'xhs':
                return {
                    bg: 'bg-white',
                    textColor: 'text-zinc-900',
                    header: '小红书',
                    accent: 'text-red-500'
                };
            case 'douyin':
                return {
                    bg: 'bg-black',
                    textColor: 'text-white',
                    header: '抖音',
                    accent: 'text-white'
                };
            case 'weixin':
                return {
                    bg: 'bg-white',
                    textColor: 'text-zinc-900',
                    header: '公众号',
                    accent: 'text-green-600'
                };
            default:
                return {
                    bg: 'bg-white',
                    textColor: 'text-zinc-900',
                    header: '预览',
                    accent: 'text-blue-500'
                };
        }
    };

    const style = getPlatformStyle();

    // Normalize content (strip HTML tags for simple preview if needed, or render html)
    // For safety and simplicity in preview, we strip tags slightly or use css line-clamp
    const cleanContent = content ? content.replace(/<[^>]+>/g, '') : '';

    return (
        <div className="relative mx-auto w-[300px] h-[600px] bg-black rounded-[40px] shadow-2xl border-4 border-zinc-800 overflow-hidden transform transition-all duration-300 hover:scale-[1.02]">
            {/* Phone Notch/Status Bar */}
            <div className="absolute top-0 left-0 w-full h-8 bg-black/20 z-20 flex justify-between px-6 items-center">
                <span className="text-[10px] text-white font-medium">9:41</span>
                <div className="w-16 h-4 bg-black rounded-b-xl" />
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-full bg-white/20" />
                    <div className="w-3 h-3 rounded-full bg-white/20" />
                </div>
            </div>

            {/* App Header (Mock) */}
            <div className={clsx("absolute top-8 left-0 w-full h-10 flex items-center justify-center z-10 border-b", platform === 'douyin' ? 'bg-transparent border-white/10' : 'bg-white/90 backdrop-blur border-zinc-100')}>
                <span className={clsx("text-sm font-bold", platform === 'douyin' ? 'text-white' : 'text-zinc-800')}>
                    {style.header}
                </span>
            </div>

            {/* Scrollable Content Area */}
            <div className={clsx("w-full h-full pt-20 pb-20 overflow-y-auto no-scrollbar", style.bg)}>
                {/* Images Carousel Mock */}
                {images && images.length > 0 ? (
                    <div className="w-full aspect-[3/4] bg-zinc-100 relative mb-3">
                        <Image
                            src={images[0]}
                            alt="内容预览"
                            fill
                            sizes="320px"
                            unoptimized
                            className="w-full h-full object-cover"
                        />
                        {images.length > 1 && (
                            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                                1/{images.length}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-full aspect-[3/4] bg-zinc-100 flex items-center justify-center text-zinc-300 mb-3">
                        <span className="text-4xl">🖼️</span>
                    </div>
                )}

                {/* Text Content */}
                <div className="px-4">
                    {title && <h3 className={clsx("font-bold text-base mb-2 leading-snug", style.textColor)}>{title}</h3>}
                    <p className={clsx("text-sm whitespace-pre-wrap leading-relaxed", style.textColor === 'text-white' ? 'text-zinc-200' : 'text-zinc-600')}>
                        {cleanContent || '等待生成内容...'}
                    </p>

                    {/* Tags Mock */}
                    <div className="mt-3 flex flex-wrap gap-1">
                        {['#AI创作', '#分发侠', '#效率工具'].map(tag => (
                            <span key={tag} className={clsx("text-xs", platform === 'douyin' ? 'text-blue-400' : 'text-blue-600')}>
                                {tag}
                            </span>
                        ))}
                    </div>

                    <div className="mt-4 text-xs text-zinc-400">
                        01-24 · 北京
                    </div>
                </div>
            </div>

            {/* Footer / Interaction Bar Mock */}
            <div className={clsx("absolute bottom-0 left-0 w-full h-16 border-t flex items-center justify-between px-6 z-20", platform === 'douyin' ? 'bg-black border-white/10 text-white' : 'bg-white border-zinc-100 text-zinc-600')}>
                <div className="flex items-center gap-2">
                    <div className="w-24 h-8 bg-zinc-100/10 rounded-full flex items-center px-3 text-xs text-zinc-400">
                        说点什么...
                    </div>
                </div>
                <div className="flex items-center gap-4 text-xl">
                    <HeartOutlined />
                    <StarOutlined />
                    <ShareAltOutlined />
                </div>
            </div>

            {/* Home Indicator */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full z-30" />
        </div>
    );
};
