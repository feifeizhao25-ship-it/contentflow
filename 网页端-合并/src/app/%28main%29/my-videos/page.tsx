'use client';

import React, { useState, useEffect } from 'react';
import {
    VideoProject,
    getVideosByPage,
    getUserVideoStats,
    getVideoCategories,
    searchVideos,
    deleteVideo,
    formatDuration,
    formatFileSize,
    VideoStats,
} from '@/lib/video-storage-service';

interface MyVideosPageProps {
    userId: string;
}

export default function MyVideosPage({ userId }: MyVideosPageProps) {
    const [videos, setVideos] = useState<VideoProject[]>([]);
    const [stats, setStats] = useState<VideoStats | null>(null);
    const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'drafts'>('all');

    // 加载数据
    useEffect(() => {
        loadData();
    }, [userId, page, selectedCategory]);

    const loadData = () => {
        setLoading(true);
        
        // 加载统计
        const videoStats = getUserVideoStats(userId);
        setStats(videoStats);
        
        // 加载分类
        const cats = getVideoCategories(userId);
        setCategories(cats);
        
        // 加载视频列表
        const result = getVideosByPage({
            userId,
            page,
            limit: 12,
            category: selectedCategory || undefined,
        });
        
        setVideos(result.videos);
        setTotal(result.total);
        setLoading(false);
    };

    // 搜索
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            const results = searchVideos(userId, searchQuery);
            setVideos(results);
            setTotal(results.length);
        } else {
            loadData();
        }
    };

    // 删除视频
    const handleDelete = (id: string) => {
        if (confirm('确定要删除这个视频吗？此操作不可恢复。')) {
            deleteVideo(id);
            loadData();
        }
    };

    // 格式化时间
    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">🎬 我的作品集</h1>
                <p className="text-gray-600">管理您生成的所有视频</p>
            </div>

            {/* 统计卡片 */}
            {stats && stats.totalVideos > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                        <div className="text-3xl font-bold">{stats.totalVideos}</div>
                        <div className="text-sm opacity-80">视频总数</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                        <div className="text-3xl font-bold">{formatDuration(stats.totalDuration)}</div>
                        <div className="text-sm opacity-80">总时长</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                        <div className="text-3xl font-bold">{stats.totalViews}</div>
                        <div className="text-sm opacity-80">总播放量</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
                        <div className="text-3xl font-bold">{formatFileSize(stats.totalSize)}</div>
                        <div className="text-sm opacity-80">占用空间</div>
                    </div>
                </div>
            )}

            {/* 搜索和筛选 */}
            <div className="mb-6">
                <form onSubmit={handleSearch} className="flex gap-4 mb-4">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="搜索视频..."
                            className="w-full px-4 py-3 border rounded-lg pr-12"
                        />
                        <button
                            type="submit"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            🔍
                        </button>
                    </div>
                </form>

                {/* 分类标签 */}
                {categories.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-4 py-2 rounded-full text-sm ${
                                selectedCategory === null
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                        >
                            全部
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.category}
                                onClick={() => setSelectedCategory(cat.category)}
                                className={`px-4 py-2 rounded-full text-sm ${
                                    selectedCategory === cat.category
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 hover:bg-gray-200'
                                }`}
                            >
                                {cat.category} ({cat.count})
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 视频列表 */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="text-4xl mb-4">⏳</div>
                    <div className="text-gray-500">加载中...</div>
                </div>
            ) : videos.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">📭</div>
                    <h3 className="text-xl font-medium mb-2">还没有视频</h3>
                    <p className="text-gray-500 mb-4">开始创作您的第一个 AI 视频吧！</p>
                    <a
                        href="/ai-create"
                        className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-colors"
                    >
                        🚀 开始创作
                    </a>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {videos.map(video => (
                            <VideoCard
                                key={video.id}
                                video={video}
                                onDelete={() => handleDelete(video.id)}
                            />
                        ))}
                    </div>

                    {/* 分页 */}
                    {total > 12 && (
                        <div className="flex justify-center gap-2 mt-8">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-4 py-2 border rounded-lg disabled:opacity-50"
                            >
                                上一页
                            </button>
                            <span className="px-4 py-2">
                                第 {page} 页 / 共 {Math.ceil(total / 12)} 页
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page >= Math.ceil(total / 12)}
                                className="px-4 py-2 border rounded-lg disabled:opacity-50"
                            >
                                下一页
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ==================== 视频卡片组件 ====================

interface VideoCardProps {
    video: VideoProject;
    onDelete: () => void;
}

function VideoCard({ video, onDelete }: VideoCardProps) {
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden group">
            {/* 缩略图 */}
            <div className="relative aspect-video bg-gray-900">
                {video.thumbnailUrl ? (
                    <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white text-center">
                            <div className="text-4xl mb-2">🎬</div>
                            <div className="text-sm">视频预览</div>
                        </div>
                    </div>
                )}
                
                {/* 时长标签 */}
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {formatDuration(video.duration)}
                </div>
                
                {/* 播放按钮 */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors">
                        <span className="text-2xl">▶️</span>
                    </button>
                </div>
                
                {/* 菜单按钮 */}
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    ⋮
                </button>
                
                {/* 菜单 */}
                {showMenu && (
                    <div className="absolute top-10 right-2 bg-white rounded-lg shadow-lg py-1 min-w-32 z-10">
                        <button className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm">
                            ✏️ 编辑
                        </button>
                        <button className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm">
                            ⬇️ 下载
                        </button>
                        <button className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm">
                            📤 分享
                        </button>
                        <hr className="my-1" />
                        <button
                            onClick={onDelete}
                            className="w-full px-4 py-2 text-left hover:bg-red-100 text-red-500 text-sm"
                        >
                            🗑️ 删除
                        </button>
                    </div>
                )}
            </div>
            
            {/* 信息 */}
            <div className="p-4">
                <h3 className="font-medium text-lg mb-1 truncate">{video.title}</h3>
                <p className="text-sm text-gray-500 mb-2">
                {new Date(video.createdAt).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                })}
            </p>
                
                <div className="flex items-center justify-between text-sm">
                    <div className="flex gap-4 text-gray-500">
                        <span>👁️ {video.views}</span>
                        <span>❤️ {video.likes}</span>
                    </div>
                    {video.category && (
                        <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                            {video.category}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
