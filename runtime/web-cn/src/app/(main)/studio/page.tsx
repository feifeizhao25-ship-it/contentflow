'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Select, Tag, message, Steps, Divider, DatePicker, TimePicker, Skeleton, Progress } from 'antd';
import { Sparkles, Send, Image as ImageIcon, CalendarClock, Layers, PlayCircle } from 'lucide-react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import { useRouter, useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { PLACEHOLDER_IMAGES } from '@/lib/placeholders';

const { TextArea } = Input;

const PLATFORMS = [
  { id: 'xhs', name: '小红书', color: '#ff2442', icon: '📕' },
  { id: 'douyin', name: '抖音', color: '#111111', icon: '🎵' },
  { id: 'weixin', name: '视频号', color: '#07c160', icon: '💬' },
  { id: 'bilibili', name: 'B站', color: '#00a1d6', icon: '📺' },
  { id: 'weibo', name: '微博', color: '#f59e0b', icon: '👁️' },
];

function StudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);

  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<'professional' | 'humorous' | 'xhs_influencer' | 'cinematic' | 'storytelling'>('professional');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['xhs']);
  const [titles, setTitles] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [script, setScript] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [visualPrompts, setVisualPrompts] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [videoLogs, setVideoLogs] = useState<string[]>([]);
  const [videoDuration, setVideoDuration] = useState(15);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [publishType, setPublishType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState<dayjs.Dayjs | null>(null);
  const [scheduledTime, setScheduledTime] = useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    setScheduledDate(dayjs());
    setScheduledTime(dayjs().add(1, 'hour'));
  }, []);

  const derivedPrompt = useMemo(() => visualPrompts[0] || topic, [visualPrompts, topic]);

  useEffect(() => {
    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const res: any = await apiClient.get('/accounts');
        if (res?.success) {
          setAccounts(res.data || res.accounts || []);
        } else {
          setAccounts(res.data || []);
        }
      } catch (e) {
        console.error('Failed to fetch accounts', e);
      } finally {
        setLoadingAccounts(false);
      }
    };
    fetchAccounts();
  }, []);

  const refreshBalance = useCallback(async () => {
    try {
      const res: any = await apiClient.get('/points/balance');
      const nextBalance = res?.data?.balance ?? res?.balance;
      if (typeof nextBalance === 'number') {
        setBalance(nextBalance);
      }
    } catch {
      setBalance(null);
    }
  }, [setBalance]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    const contentId = searchParams.get('contentId');
    if (!contentId) return;

    const loadTemplate = async () => {
      try {
        const res: any = await apiClient.get(`/contents/${contentId}`);
        const data = res?.data || res;
        if (data?.title) {
          setTopic(data.title);
          setTitles([data.title]);
          setSelectedTitle(data.title);
        }
        if (data?.body) {
          setScript(data.body);
        }
        if (data?.cover_url) {
          setCoverUrl(data.cover_url);
        }

        try {
          const assetsRes: any = await apiClient.get(`/contents/${contentId}/assets`);
          const assets = assetsRes?.data?.assets || assetsRes?.assets || [];
          const scriptAsset = assets.find((asset: any) => asset.type === 'script');
          if (scriptAsset?.meta?.content) {
            setScript(scriptAsset.meta.content);
          }
          const coverAsset = assets.find((asset: any) => asset.type === 'cover' && asset.url);
          if (coverAsset?.url) {
            setCoverUrl(coverAsset.url);
          }
        } catch {
          // ignore assets
        }
      } catch (e) {
        console.warn('Failed to load template content', e);
      }
    };

    loadTemplate();
  }, [searchParams]);

  const handleGeneratePack = async () => {
    if (!topic.trim()) {
      message.warning('请输入主题或一句话灵感');
      return;
    }
    setIsGenerating(true);
    try {
      message.loading({ content: '正在构建内容包...', key: 'gen' });
      const articleRes: any = await apiClient.post('/ai/generate/article', {
        topic,
        style,
        platform: selectedPlatforms[0] || 'xhs',
      });

      const articleData = articleRes?.data || articleRes;
      setScript(articleData?.content || '');
      setVisualPrompts(articleData?.visualPrompts || []);

      const titleRes: any = await apiClient.post('/ai/generate/titles', {
        topic,
        platform: selectedPlatforms[0] || 'xhs',
        count: 6,
      });
      const nextTitles = titleRes?.data?.titles || titleRes?.titles || [];
      setTitles(nextTitles);
      if (nextTitles.length > 0) {
        setSelectedTitle(nextTitles[0]);
      }

      await refreshBalance();
      trackEvent('content_pack_generated', {
        platform: selectedPlatforms[0] || 'xhs',
        style,
      });
      message.success({ content: '内容包生成完成', key: 'gen' });
    } catch (e: any) {
      console.error('Generation Error Detail:', e);
      message.error({ content: `生成失败: ${e.message || '未知错误'}`, key: 'gen' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCover = async () => {
    if (!derivedPrompt) {
      message.warning('请先生成内容包或填写主题');
      return;
    }
    setIsGeneratingImage(true);
    try {
      message.loading({ content: '正在生成封面...', key: 'cover' });
      const res: any = await apiClient.post('/ai/generate/image', {
        prompt: derivedPrompt,
        style: style === 'xhs_influencer' ? 'xhs_influencer' : 'professional',
      });
      const imageData = res?.data || res;
      setCoverUrl(imageData?.url || '');
      await refreshBalance();
      trackEvent('cover_generated', {
        style,
      });
      message.success({ content: '封面已生成', key: 'cover' });
    } catch (e: any) {
      message.error({ content: e.message || '封面生成失败', key: 'cover' });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!topic.trim()) {
      message.warning('请输入主题以生成视频');
      return;
    }
    setIsGeneratingVideo(false);
    setVideoUrl('');
    setVideoProgress(0);
    setVideoLogs(['视频生成后端尚未启用，本次未创建任务。']);
    message.info('视频生成后端尚未启用；系统不会用模拟进度或占位视频冒充结果');
  };

  const handleCreatePublishTasks = async () => {
    if (!script.trim()) {
      message.warning('请先生成内容包');
      return;
    }
    if (selectedPlatforms.length === 0) {
      message.warning('请选择至少一个发布平台');
      return;
    }

    try {
      message.loading({ content: '正在创建发布任务...', key: 'publish' });
      const contentRes: any = await apiClient.post('/contents', {
        title: selectedTitle || topic || '未命名内容',
        body: script,
        content_type: 'article',
        cover_url: coverUrl || undefined,
        media_urls: coverUrl ? [coverUrl] : [],
        tags: ['内容工作室'],
      });
      const contentId = contentRes?.data?.id || contentRes?.content?.id || contentRes?.id;
      if (!contentId) {
        throw new Error('内容创建失败');
      }

      await apiClient.post(`/contents/${contentId}/submit`, {});
      await apiClient.post(`/contents/${contentId}/review`, {
        action: 'approve',
        comment: '用户本人在创建发布任务时确认内容可发布',
      });

      try {
        const assets: Array<{ type: string; url: string; label: string; meta?: any }> = [
          { type: 'script', url: '', label: '正文脚本', meta: { content: script } },
        ];
        if (coverUrl) {
          assets.push({ type: 'cover', url: coverUrl, label: '封面图' });
        }
        await apiClient.post(`/contents/${contentId}/assets`, { assets });
      } catch (e) {
        console.warn('Failed to append assets', e);
      }

      const scheduleAt = publishType === 'scheduled' && scheduledDate && scheduledTime
        ? dayjs(`${scheduledDate.format('YYYY-MM-DD')} ${scheduledTime.format('HH:mm')}`).toISOString()
        : undefined;

      let nextAccounts = accounts;
      if (!nextAccounts.length) {
        try {
          const accountRes: any = await apiClient.get('/accounts');
          nextAccounts = accountRes?.data || accountRes?.accounts || [];
          setAccounts(nextAccounts);
        } catch (e) {
          console.warn('Failed to refresh accounts before publish', e);
        }
      }

      const validTargets = selectedPlatforms
        .map((platform) => ({ platform, account: nextAccounts.find((a) => a.platform === platform && a.status === 'active') }))
        .filter((item) => item.account);

      if (validTargets.length !== selectedPlatforms.length) {
        const missing = selectedPlatforms.filter(platform => !validTargets.some(target => target.platform === platform));
        message.warning(`以下平台没有可用账号：${missing.join('、')}。未创建任何发布任务。`);
        return;
      }

      await apiClient.post('/publish/tasks', {
        contentId,
        platformAccountIds: validTargets.map(({ account }) => account.id),
        publishType,
        scheduledAt: scheduleAt,
      });

      trackEvent('publish_task_created', {
        platforms: validTargets.map((item) => item.platform),
        publishType,
      });
      message.success({ content: '发布任务已创建', key: 'publish' });

      window.location.href = '/publish';
    } catch (e: any) {
      message.error({ content: e.message || '发布失败', key: 'publish' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="bg-white/90 border border-zinc-200 rounded-[28px] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif text-zinc-900">创作工作室</h1>
            <p className="text-sm text-zinc-500 mt-2">从灵感到发布，今天就完成一次完整闭环。</p>
          </div>
          <div className="flex items-center gap-3">
            <Tag color="gold">发布完成为核心目标</Tag>
            <Button onClick={() => router.push('/publish')}>查看发布中心</Button>
          </div>
        </div>
      </div>

      <Card className="rounded-[24px] border-none">
        <Steps
          current={script ? (coverUrl ? 2 : 1) : 0}
          items={[
            { title: '主题与平台', description: '定义核心方向' },
            { title: '内容生成', description: 'AI 文案/图片/视频' },
            { title: '分发排期', description: '多平台一键搞定' },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 rounded-[24px] border-none">
          <h3 className="text-lg font-serif mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            主题输入
          </h3>
          <Input
            placeholder="一句话描述你想做的内容"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="rounded-xl"
          />
          <div className="mt-4 space-y-3">
            <div>
              <div className="text-xs text-zinc-500 mb-2">选择平台</div>
              <Select
                mode="multiple"
                value={selectedPlatforms}
                onChange={setSelectedPlatforms}
                className="w-full"
                options={PLATFORMS.map(p => ({ label: `${p.icon} ${p.name}`, value: p.id }))}
              />
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-2">风格偏好</div>
              <Select
                value={style}
                onChange={setStyle}
                className="w-full"
                options={[
                  { label: '专业干货', value: 'professional' },
                  { label: '幽默轻松', value: 'humorous' },
                  { label: '小红书种草', value: 'xhs_influencer' },
                  { label: '故事叙事', value: 'storytelling' },
                  { label: '电影质感', value: 'cinematic' },
                ]}
              />
            </div>
          </div>
          <Button
            type="primary"
            icon={<Sparkles className="w-4 h-4" />}
            className="mt-6 bg-[#1f4d4f] border-none w-full"
            loading={isGenerating}
            onClick={handleGeneratePack}
          >
            一键生成文案包
          </Button>
          <p className="text-[10px] text-zinc-400 mt-2 flex justify-between items-center bg-zinc-50 p-2 rounded-lg">
            <span>✨ 单次消耗：<span className="text-emerald-600 font-bold">5 积分</span></span>
            <span>可用余额：<span className="text-amber-600 font-bold">{balance ?? '暂不可用'}</span></span>
          </p>

          <Divider className="my-6" />

          <h3 className="text-sm font-bold mb-4 flex items-center justify-between">
            <span>智能视频生成</span>
            <Tag color="purple">测试版</Tag>
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">期望时长</span>
              <Select
                size="small"
                value={videoDuration}
                onChange={setVideoDuration}
                options={[
                  { label: '10秒 (快速)', value: 10 },
                  { label: '15秒 (标准)', value: 15 },
                  { label: '30秒 (完整)', value: 30 },
                ]}
              />
            </div>
            <Button
              block
              icon={<PlayCircle className="w-4 h-4" />}
              loading={isGeneratingVideo}
              onClick={handleGenerateVideo}
              className="rounded-xl border-dashed border-zinc-300 hover:border-indigo-500 hover:text-indigo-600 h-10"
            >
              生成带分镜的视频
            </Button>
            <p className="text-[10px] text-zinc-400 mt-1">视频生成单次消耗：<span className="text-emerald-600 font-bold">20 积分</span></p>
          </div>
        </Card>

        <Card className="lg:col-span-2 rounded-[24px] border-none">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-serif flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              内容包结构预览
            </h3>
            <Button icon={<ImageIcon className="w-4 h-4" />} onClick={handleGenerateCover} loading={isGeneratingImage}>
              生成封面
            </Button>
          </div>
          <Divider className="my-4" />
          {isGenerating ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-zinc-500 mb-2">标题推荐</div>
                <div className="flex flex-wrap gap-2">
                  {titles.length > 0 ? titles.map((t, idx) => (
                    <Tag
                      key={idx}
                      className={clsx('cursor-pointer', selectedTitle === t ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-zinc-100')}
                      onClick={() => setSelectedTitle(t)}
                    >
                      {t}
                    </Tag>
                  )) : <span className="text-xs text-zinc-400">生成后显示</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-2">正文脚本</div>
                <TextArea
                  rows={10}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="内容包生成后自动填充，可继续编辑"
                />
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-2 flex justify-between items-center">
                  <span>多媒体预览 (封面 / 视频)</span>
                  {coverUrl && <Button type="link" size="small" className="p-0 h-auto text-xs">重新生成</Button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative aspect-video rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-100">
                    <img
                      src={coverUrl || PLACEHOLDER_IMAGES.cover}
                      alt="cover"
                      className="w-full h-full object-cover"
                    />
                    {!coverUrl && (
                      <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-xs text-white text-center p-4">
                        <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                        <div>AI 封面未生成<br />生成后将自动替换示例图</div>
                      </div>
                    )}
                  </div>

                  <div className="relative aspect-video rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-900 flex flex-col items-center justify-center">
                    {isGeneratingVideo ? (
                      <div className="w-full h-full p-4 flex flex-col justify-center gap-4 bg-zinc-900/90 overflow-hidden">
                        <div className="text-[10px] text-indigo-400 font-mono space-y-1 max-h-32 overflow-y-auto">
                          {videoLogs.map((log, i) => (
                            <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} key={i}>{log}</motion.div>
                          ))}
                        </div>
                        <Progress percent={videoProgress} size="small" strokeColor="#6366f1" showInfo={false} />
                      </div>
                    ) : videoUrl ? (
                      <video src={videoUrl} controls className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-center p-6 space-y-2">
                        <PlayCircle className="w-10 h-10 text-zinc-700 mx-auto" />
                        <div className="text-xs text-zinc-600 italic">点击左侧“生成视频”<br />见证 AI 电影工厂</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="rounded-[24px] border-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-serif flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-600" />
              发布草案
            </h3>
            <p className="text-xs text-zinc-500 mt-2">生成后即可一键多平台发布或排期。</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={publishType} onChange={setPublishType} options={[
              { label: '立即发布', value: 'immediate' },
              { label: '定时发布', value: 'scheduled' },
            ]} />
            {publishType === 'scheduled' && (
              <>
                <DatePicker value={scheduledDate} onChange={(val) => val && setScheduledDate(val)} />
                <TimePicker value={scheduledTime} onChange={(val) => val && setScheduledTime(val)} format="HH:mm" />
              </>
            )}
          </div>
        </div>
        <Divider />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 text-sm text-zinc-600">
            <div>发布平台：{selectedPlatforms.map(p => PLATFORMS.find(x => x.id === p)?.name || p).join('、')}</div>
            <div>已绑定账号：{loadingAccounts ? '加载中...' : `${accounts.length} 个`}</div>
            <div>内容标题：{selectedTitle || topic || '未命名内容'}</div>
          </div>
          <Button type="primary" icon={<Send className="w-4 h-4" />} className="bg-[#1f4d4f] border-none" onClick={handleCreatePublishTasks}>
            创建发布任务
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function StudioPage() {
  return (
    <React.Suspense fallback={<Skeleton active />}>
      <StudioContent />
    </React.Suspense>
  );
}
