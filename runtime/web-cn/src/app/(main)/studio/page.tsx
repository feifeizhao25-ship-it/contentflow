'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import NextImage from 'next/image';
import { Button, Card, Input, Select, Tag, message, Steps, Divider, DatePicker, TimePicker, Skeleton } from 'antd';
import { Sparkles, Send, Image as ImageIcon, CalendarClock, Layers, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { apiClient } from '@/lib/api-client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAchievementStore } from '@/store/appStore';
import { trackEvent } from '@/lib/analytics';
import { PLACEHOLDER_IMAGES } from '@/lib/placeholders';
import { safeErrorText } from '@/lib/api-error';
import { isAiGeneratedText } from '@/lib/ai-content-label';
import { ComplianceReviewNotice } from '@/components/compliance/ComplianceReviewNotice';
import { isManualPlatform, PUBLISH_CHANNEL_NOTICE } from '@/lib/manual-publish';
import { describeAiAllowance, type AiAllowanceView } from '@/lib/page-data';

const { TextArea } = Input;

const PLATFORMS = [
  { id: 'xhs', name: '小红书', color: '#ff2442', icon: '📕' },
  { id: 'douyin', name: '抖音', color: '#111111', icon: '🎵' },
  { id: 'weixin', name: '视频号', color: '#07c160', icon: '💬' },
  { id: 'bilibili', name: 'B站', color: '#00a1d6', icon: '📺' },
  { id: 'wechat_mp', name: '公众号', color: '#16a34a', icon: '📰' },
];

function StudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 本月 AI 额度：来自 GET /billing/subscription（与 AI 接口的额度闸同一算法），不再显示签到积分
  const [allowance, setAllowance] = useState<AiAllowanceView>(() => describeAiAllowance(null));
  const { unlockAchievement, isUnlocked } = useAchievementStore();

  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<'professional' | 'humorous' | 'xhs_influencer' | 'cinematic' | 'storytelling'>('professional');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['xhs']);
  const [titles, setTitles] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [script, setScript] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  // 本次会话里的内容 / 封面是 AI 生成的：保存到内容库时标记 source=ai，分发时才会保留 AI 生成标识
  const [scriptIsAi, setScriptIsAi] = useState(false);
  const [coverIsAi, setCoverIsAi] = useState(false);
  const [visualPrompts, setVisualPrompts] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

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
      setAllowance(describeAiAllowance(await apiClient.get('/billing/subscription')));
    } catch {
      setAllowance(describeAiAllowance(null));
    }
  }, []);

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
      setScriptIsAi(true);
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
      message.error({ content: `生成失败: ${safeErrorText(e, '未知错误')}`, key: 'gen' });
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
      setCoverIsAi(true);
      await refreshBalance();
      trackEvent('cover_generated', {
        style,
      });
      message.success({ content: '封面已生成', key: 'cover' });
    } catch (e: any) {
      message.error({ content: safeErrorText(e, '封面生成失败'), key: 'cover' });
    } finally {
      setIsGeneratingImage(false);
    }
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
        source: isAiGeneratedText(script, scriptIsAi || coverIsAi) ? 'ai' : 'manual',
      });
      const contentId = contentRes?.data?.id || contentRes?.content?.id || contentRes?.id;
      if (!contentId) {
        throw new Error('内容创建失败');
      }

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

      const contentStatus = contentRes?.data?.status || contentRes?.content?.status || contentRes?.status;
      // 新内容是草稿：自动发布和人工确认发布都要求内容先审核通过（后端会拒绝）。
      // 原来这里照样去建发布任务，必然失败；现在如实告诉用户下一步。
      if (contentStatus !== 'approved' && contentStatus !== 'published') {
        message.info({ content: '内容已保存为草稿。提交审核并通过后，可在内容库创建发布任务（小红书、视频号、公众号走人工确认发布）。', key: 'publish', duration: 6 });
        router.push('/contents');
        return;
      }

      const scheduleAt = publishType === 'scheduled' && scheduledDate && scheduledTime
        ? dayjs(`${scheduledDate.format('YYYY-MM-DD')} ${scheduledTime.format('HH:mm')}`).toISOString()
        : undefined;

      // 小红书 / 视频号 / 公众号：人工确认发布（复制文案、下载带 AI 标识的封面、手动发出后确认）
      const manualPlatforms = selectedPlatforms.filter(isManualPlatform);
      if (manualPlatforms.length) {
        await apiClient.post('/publish/manual-tasks', { contentId, platforms: manualPlatforms, scheduledAt: scheduleAt });
      }

      // 抖音 / B 站：只有完成开放平台授权、绑定了账号才能自动发布
      const autoPlatforms = selectedPlatforms.filter((p) => !isManualPlatform(p));
      let nextAccounts = accounts;
      if (autoPlatforms.length && !nextAccounts.length) {
        try {
          const accountRes: any = await apiClient.get('/accounts');
          nextAccounts = accountRes?.data || accountRes?.accounts || [];
          setAccounts(nextAccounts);
        } catch (e) {
          console.warn('Failed to refresh accounts before publish', e);
        }
      }
      const autoAccounts = autoPlatforms
        .map((platform) => nextAccounts.find((a) => a.platform === platform))
        .filter(Boolean) as any[];
      if (autoAccounts.length) {
        await apiClient.post('/publish/tasks', {
          contentId,
          platformAccountIds: autoAccounts.map((a) => a.id),
          publishType,
          scheduledAt: scheduleAt,
        });
      } else if (autoPlatforms.length) {
        message.warning('抖音、B 站需要先完成开放平台授权，本次没有为它们创建任务');
      }

      trackEvent('publish_task_created', {
        platforms: [...manualPlatforms, ...autoAccounts.map((a) => a.platform)],
        publishType,
      });
      message.success({ content: '发布任务已创建', key: 'publish' });

      if (!isUnlocked('first_publish_task')) {
        unlockAchievement('first_publish_task');
        message.open({
          type: 'success',
          content: '徽章已点亮：首个发布任务',
          duration: 3,
        });
      }

      window.location.href = '/publish';
    } catch (e: any) {
      message.error({ content: safeErrorText(e, '发布失败'), key: 'publish' });
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

      <ComplianceReviewNotice />

      <Card className="rounded-[24px] border-none">
        <Steps
          current={script ? (coverUrl ? 2 : 1) : 0}
          items={[
            { title: '主题与平台', description: '定义核心方向' },
            { title: '内容生成', description: 'AI 文案与封面' },
            { title: '分发排期', description: '自动发布或人工确认发布' },
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
            disabled={allowance.exhausted}
            onClick={handleGeneratePack}
          >
            一键生成文案包
          </Button>
          <div className="text-xs text-zinc-500 mt-2 bg-zinc-50 p-2 rounded-lg space-y-1" data-testid="ai-allowance">
            <div className={clsx('font-medium', allowance.exhausted ? 'text-red-600' : 'text-zinc-700')}>{allowance.summary}</div>
            {allowance.exhausted && (
              <div>本月额度已用完，可 <Link href="/pricing" className="text-indigo-600">升级套餐</Link>，或等下月 1 日恢复。</div>
            )}
            <div className="text-[11px] text-zinc-400">{allowance.rule}</div>
          </div>

          <Divider className="my-6" />

          {/* 视频生成：国内版还没有接入境内视频模型，不以「测试版」露出，只说明暂未开放且不可点 */}
          <div className="flex items-center justify-between gap-3 text-sm text-zinc-400" aria-disabled="true">
            <span className="flex items-center gap-2"><PlayCircle className="w-4 h-4" />视频生成</span>
            <Tag className="m-0">暂未开放</Tag>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">国内版还没有接入视频模型，开放后会在这里提示。</p>
        </Card>

        <Card className="lg:col-span-2 rounded-[24px] border-none">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-serif flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              内容包结构预览
            </h3>
            <Button icon={<ImageIcon className="w-4 h-4" />} onClick={handleGenerateCover} loading={isGeneratingImage} disabled={allowance.exhausted}>
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
                  <span>封面预览</span>
                  {coverUrl && <Button type="link" size="small" className="p-0 h-auto text-xs" loading={isGeneratingImage} disabled={allowance.exhausted} onClick={handleGenerateCover}>重新生成</Button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative aspect-video rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-100">
                    <NextImage
                      src={coverUrl || PLACEHOLDER_IMAGES.cover}
                      alt="封面预览"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                    {coverUrl && coverIsAi && (
                      <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">AI 生成</div>
                    )}
                    {!coverUrl && (
                      <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-xs text-white text-center p-4">
                        <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                        <div>AI 封面未生成<br />生成后将自动替换示例图</div>
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
            <p className="text-xs text-zinc-500 mt-2">{PUBLISH_CHANNEL_NOTICE}。</p>
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
