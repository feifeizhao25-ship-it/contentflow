'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    TrophyOutlined, 
    FireOutlined, 
    HeartOutlined, 
    HeartFilled,
    StarOutlined,
    ShareAltOutlined,
    CommentOutlined,
    PlusOutlined,
    SearchOutlined,
    FilterOutlined
} from '@ant-design/icons';
import { 
    Button, 
    Tabs, 
    Input, 
    Card, 
    Avatar, 
    Badge, 
    Modal, 
    message,
    Empty,
    Spin
} from 'antd';
import clsx from 'clsx';
import Link from 'next/link';

// 模拟社区数据
interface CommunityContent {
    id: string;
    title: string;
    content: string;
    author: {
        id: string;
        name: string;
        avatar: string;
        isPro: boolean;
    };
    likes: number;
    comments: number;
    views: number;
    createdAt: string;
    tags: string[];
    images?: string[];
    isLiked: boolean;
}

const MOCK_CONTENTS: CommunityContent[] = [
    {
        id: '1',
        title: '分享我用 AI 生成的一周爆款内容',
        content: '通过分发侠的 AI 创作功能，我一周内发布了 7 篇爆款内容，点赞量突破 10 万！关键是要抓住用户痛点，用好 AI 的创意生成功能。',
        author: {
            id: 'u1',
            name: '内容创作者小王',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wang',
            isPro: true
        },
        likes: 1234,
        comments: 89,
        views: 5678,
        createdAt: '2小时前',
        tags: ['AI创作', '爆款', '技巧分享'],
        isLiked: false
    },
    {
        id: '2',
        title: 'AI 辅助写作的三个实用技巧',
        content: '1. 明确指令越具体，AI 产出质量越高 2. 用好"继续"命令扩展内容 3. 多次迭代优化，AI 也是需要调教的',
        author: {
            id: 'u2',
            name: 'AI 实验室',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ai',
            isPro: true
        },
        likes: 892,
        comments: 45,
        views: 3456,
        createdAt: '5小时前',
        tags: ['AI写作', '技巧', '教程'],
        isLiked: true
    },
    {
        id: '3',
        title: '第一次用 AI 就做出 10w+ 内容',
        content: '说实话之前完全不会写文案，没想到 AI 帮我生成的内容阅读量直接破 10 万！分发侠太强了。',
        author: {
            id: 'u3',
            name: '新手入门',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=new',
            isPro: false
        },
        likes: 567,
        comments: 23,
        views: 2345,
        createdAt: '1天前',
        tags: ['新手体验', 'AI生成'],
        isLiked: false
    }
];

// 周排行榜
const WEEKLY_RANKING = [
    { rank: 1, name: '内容创作者小王', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wang', likes: 12340, isPro: true },
    { rank: 2, name: 'AI 实验室', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ai', likes: 8920, isPro: true },
    { rank: 3, name: '运营大神', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ops', likes: 6540, isPro: true },
    { rank: 4, name: '文案高手', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=copy', likes: 4320, isPro: false },
    { rank: 5, name: '创意达人', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=idea', likes: 3210, isPro: false },
];

// 标签分类
const TAGS = ['全部', 'AI创作', '技巧分享', '新手体验', '案例分析', '工具评测', '行业动态'];

// 内容卡片组件
function ContentCard({ content, onLike, onShare }: { 
    content: CommunityContent; 
    onLike: (id: string) => void;
    onShare: (id: string) => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-zinc-200 p-5 hover:shadow-lg transition-all"
        >
            {/* 作者信息 */}
            <div className="flex items-center gap-3 mb-4">
                <Avatar size={44} src={content.author.avatar} />
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900">{content.author.name}</span>
                        {content.author.isPro && (
                            <span className="px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-white text-xs font-bold">
                                PRO
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-zinc-500">{content.createdAt}</span>
                </div>
            </div>

            {/* 内容 */}
            <h3 className="text-lg font-bold text-zinc-900 mb-2">{content.title}</h3>
            <p className="text-zinc-600 text-sm line-clamp-3 mb-4">{content.content}</p>

            {/* 标签 */}
            <div className="flex flex-wrap gap-2 mb-4">
                {content.tags.map((tag) => (
                    <span 
                        key={tag}
                        className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-xs"
                    >
                        {tag}
                    </span>
                ))}
            </div>

            {/* 统计和操作 */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => onLike(content.id)}
                        className={clsx(
                            "flex items-center gap-1.5 text-sm transition-colors",
                            content.isLiked ? "text-red-500" : "text-zinc-500 hover:text-red-500"
                        )}
                    >
                        {content.isLiked ? (
                            <HeartFilled className="text-lg" />
                        ) : (
                            <HeartOutlined className="text-lg" />
                        )}
                        {content.likes}
                    </button>
                    <div className="flex items-center gap-1.5 text-sm text-zinc-500">
                        <CommentOutlined className="text-lg" />
                        {content.comments}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-zinc-500">
                        <FireOutlined className="text-lg" />
                        {content.views}
                    </div>
                </div>
                <button 
                    onClick={() => onShare(content.id)}
                    className="p-2 text-zinc-500 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                    <ShareAltOutlined className="text-lg" />
                </button>
            </div>
        </motion.div>
    );
}

// 排行榜卡片
function RankingCard({ rank, data }: { rank: number; data: typeof WEEKLY_RANKING[0] }) {
    const getRankStyle = () => {
        if (rank === 1) return { bg: 'bg-gradient-to-br from-amber-400 to-orange-500', text: 'text-white', icon: '🥇' };
        if (rank === 2) return { bg: 'bg-gradient-to-br from-zinc-300 to-zinc-400', text: 'text-white', icon: '🥈' };
        if (rank === 3) return { bg: 'bg-gradient-to-br from-orange-300 to-orange-400', text: 'text-white', icon: '🥉' };
        return { bg: 'bg-zinc-100', text: 'text-zinc-600', icon: String(rank) };
    };

    const style = getRankStyle();

    return (
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-zinc-200 hover:shadow-md transition-all">
            <div className={clsx(
                "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm",
                style.bg,
                style.text
            )}>
                {style.icon}
            </div>
            <Avatar size={40} src={data.avatar} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 truncate">{data.name}</span>
                    {data.isPro && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded text-xs">PRO</span>
                    )}
                </div>
                <span className="text-xs text-zinc-500">{data.likes.toLocaleString()} 点赞</span>
            </div>
        </div>
    );
}

export default function CommunityPage() {
    const [activeTab, setActiveTab] = useState<'hot' | 'latest' | 'following'>('hot');
    const [selectedTag, setSelectedTag] = useState('全部');
    const [contents, setContents] = useState(MOCK_CONTENTS);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [shareModal, setShareModal] = useState({ open: false, contentId: '' });
    const [createModal, setCreateModal] = useState(false);

    // 模拟加载
    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [activeTab, selectedTag]);

    // 点赞
    const handleLike = (id: string) => {
        setContents(prev => prev.map(item => {
            if (item.id === id) {
                return {
                    ...item,
                    likes: item.isLiked ? item.likes - 1 : item.likes + 1,
                    isLiked: !item.isLiked
                };
            }
            return item;
        }));
    };

    // 分享
    const handleShare = (id: string) => {
        setShareModal({ open: true, contentId: id });
    };

    // 实际分享
    const doShare = (platform: string) => {
        message.success('分享成功！');
        setShareModal({ open: false, contentId: '' });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
            {/* 头部 */}
            <div className="bg-white border-b border-zinc-200 sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-900">创作者社区</h1>
                            <p className="text-sm text-zinc-500">分享创作心得，结识优秀创作者</p>
                        </div>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setCreateModal(true)}
                            className="!bg-indigo-600 !rounded-xl"
                        >
                            发布内容
                        </Button>
                    </div>

                    {/* 标签筛选 */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2">
                        {TAGS.map((tag) => (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(tag)}
                                className={clsx(
                                    "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                                    selectedTag === tag
                                        ? "bg-zinc-900 text-white"
                                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                                )}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="flex gap-6">
                    {/* 左侧主内容 */}
                    <div className="flex-1">
                        {/* 搜索 */}
                        <div className="mb-4">
                            <Input
                                placeholder="搜索内容..."
                                prefix={<SearchOutlined className="text-zinc-400" />}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="!rounded-xl !h-12"
                            />
                        </div>

                        {/* Tabs */}
                        <Tabs
                            activeKey={activeTab}
                            onChange={(key) => setActiveTab(key as typeof activeTab)}
                            className="mb-6"
                            items={[
                                { key: 'hot', label: (
                                    <span className="flex items-center gap-1">
                                        <FireOutlined /> 热门
                                    </span>
                                )},
                                { key: 'latest', label: '最新' },
                                { key: 'following', label: '关注' },
                            ]}
                        />

                        {/* 内容列表 */}
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Spin size="large" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <AnimatePresence mode="popLayout">
                                    {contents.map((content) => (
                                        <ContentCard
                                            key={content.id}
                                            content={content}
                                            onLike={handleLike}
                                            onShare={handleShare}
                                        />
                                    ))}
                                </AnimatePresence>

                                {contents.length === 0 && (
                                    <Empty 
                                        description="暂无内容" 
                                        className="py-12"
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {/* 右侧排行榜 */}
                    <div className="w-80 hidden lg:block">
                        <div className="sticky top-24">
                            <Card className="!rounded-2xl !border-zinc-200">
                                <div className="flex items-center gap-2 mb-4">
                                    <TrophyOutlined className="text-amber-500 text-xl" />
                                    <h3 className="font-bold text-zinc-900">本周排行榜</h3>
                                </div>
                                
                                <div className="space-y-3">
                                    {WEEKLY_RANKING.map((item, index) => (
                                        <RankingCard 
                                            key={item.name} 
                                            rank={index + 1} 
                                            data={item} 
                                        />
                                    ))}
                                </div>

                                <Button 
                                    block 
                                    className="mt-4 !rounded-xl"
                                >
                                    查看完整榜单
                                </Button>
                            </Card>

                            {/* 社区规则 */}
                            <Card className="!rounded-2xl !border-zinc-200 mt-4">
                                <h4 className="font-bold text-zinc-900 mb-3">社区规则</h4>
                                <ul className="space-y-2 text-sm text-zinc-600">
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500">✓</span>
                                        分享真实创作经验
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500">✓</span>
                                        友善交流，互相帮助
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500">✓</span>
                                        优质内容可获奖励
                                    </li>
                                </ul>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>

            {/* 分享弹窗 */}
            <Modal
                open={shareModal.open}
                onCancel={() => setShareModal({ open: false, contentId: '' })}
                footer={null}
                closable={false}
                width={360}
                centered
                className="share-modal"
            >
                <div className="text-center py-4">
                    <h3 className="font-bold text-zinc-900 mb-4">分享到</h3>
                    <div className="flex justify-center gap-4">
                        {[
                            { name: '微信', icon: '💬', color: 'bg-green-500' },
                            { name: '微博', icon: '📢', color: 'bg-red-500' },
                            { name: '复制链接', icon: '🔗', color: 'bg-zinc-500' },
                        ].map((item) => (
                            <button
                                key={item.name}
                                onClick={() => doShare(item.name)}
                                className="flex flex-col items-center gap-2"
                            >
                                <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center text-xl", item.color, "text-white")}>
                                    {item.icon}
                                </div>
                                <span className="text-xs text-zinc-500">{item.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* 创建内容弹窗 */}
            <Modal
                open={createModal}
                onCancel={() => setCreateModal(false)}
                footer={null}
                width={600}
                centered
                className="create-modal"
            >
                <div className="py-4">
                    <h3 className="font-bold text-zinc-900 text-lg mb-4">发布创作</h3>
                    <p className="text-zinc-500 text-sm mb-4">
                        分享你的创作心得，让更多人看到你的作品
                    </p>
                    
                    <div className="bg-indigo-50 rounded-xl p-4 mb-4">
                        <p className="text-sm text-indigo-700">
                            💡 优质内容有机会获得官方推荐和奖励哦！
                        </p>
                    </div>

                    <Button 
                        type="primary" 
                        block 
                        size="large"
                        onClick={() => {
                            setCreateModal(false);
                            // 跳转到创建页面
                        }}
                        className="!h-12 !rounded-xl !bg-indigo-600"
                    >
                        去发布内容
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
