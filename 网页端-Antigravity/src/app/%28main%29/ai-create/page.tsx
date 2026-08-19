'use client';

import React, { useState } from 'react';
import { message } from 'antd';
import { ContentPackPanel } from '@/components/ai-create/ContentPackPanel';
import { MainWorkspace } from '@/components/ai-create/MainWorkspace';
import { GrowthSidebar } from '@/components/ai-create/GrowthSidebar';
import { aiService } from '@/lib/ai-service';
import { usePointsStore } from '@/store/pointsStore';

export default function AICreatePage() {
    const [activeSection, setActiveSection] = useState('title');
    const [topic, setTopic] = useState('');
    const [content, setContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Points System
    const { spendPoints, balance } = usePointsStore();

    const handleGenerate = async () => {
        if (!topic) {
            message.warning('请输入创作主题');
            return;
        }
        if (balance < 5) {
            message.error('积分不足，建议生成需要 5 积分');
            return;
        }

        setIsGenerating(true);
        try {
            message.loading({ content: 'AI 正在深度思考...', key: 'gen' });

            const res = await aiService.generateArticle({
                prompt: topic,
                style: 'professional', // Default for now
            });

            setContent(res.content);
            spendPoints(5, 'content_generation', `生成: ${topic}`);
            message.success({ content: '内容包生成成功！', key: 'gen' });
        } catch (error: any) {
            message.error({ content: error.message || '生成失败', key: 'gen' });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row overflow-hidden bg-background">
            {/* Left Panel: Content Pack Navigation */}
            <div className="hidden md:block flex-none h-full z-20 shadow-sm transition-all duration-300">
                <ContentPackPanel
                    activeSection={activeSection}
                    onSectionChange={setActiveSection}
                />
            </div>

            {/* Center Panel: Main Workspace */}
            <div className="flex-1 h-full min-w-0 z-10 w-full mb-20 md:mb-0">
                <MainWorkspace
                    topic={topic}
                    onTopicChange={setTopic}
                    content={content}
                    onContentChange={setContent}
                    onGenerate={handleGenerate}
                    isGenerating={isGenerating}
                />
            </div>

            {/* Right Panel: Growth & Hook Sidebar */}
            <div className="hidden md:block flex-none h-full z-20 shadow-sm transition-all duration-300">
                <GrowthSidebar />
            </div>
        </div>
    );
}
