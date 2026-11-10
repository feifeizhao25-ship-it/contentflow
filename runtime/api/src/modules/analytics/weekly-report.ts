import { OverviewLang, PublishSummary } from './own-data-overview';
import { Cell, Sheet } from './xlsx';

export interface WeeklyContentRow {
  title: string | null;
  content_type: string;
  status: string;
  created_at: Date;
}

export interface WeeklyTaskRow {
  platform: string | null;
  status: string;
  scheduled_at: Date | null;
  created_at: Date;
}

export interface WeeklyAiSummary {
  generations: number;
  byType: Array<{ label: string; count: number }>;
  savedAsContent: number;
  approvedOrPublished: number;
}

export interface WeeklyReportData {
  lang: OverviewLang;
  windowStart: Date;
  windowEnd: Date;
  publish: PublishSummary;
  ai: WeeklyAiSummary;
  contents: WeeklyContentRow[];
  tasks: WeeklyTaskRow[];
  engagementNote: string;
  truncated: boolean;
}

const COPY = {
  zh: {
    summary: '概览',
    content: '内容',
    publishing: '发布任务',
    engagement: '互动',
    title: '本周工作区报告',
    window: '统计窗口（北京时间）',
    basis: '以下数字只来自本工作区已保存的记录。没有记录时写明「没有记录」，不是估算的播放或涨粉。',
    publishTotal: '发布任务数',
    published: '已发布',
    failed: '失败',
    inProgress: '进行中',
    manualPending: '待人工发布',
    manualDone: '已人工发布',
    cancelled: '已取消',
    generations: 'AI 生成次数',
    saved: '保存进内容库',
    approved: '已通过或已发布',
    noPublish: '本周没有保存任何发布任务。',
    contentHeaders: ['标题', '类型', '状态', '创建时间'],
    noContent: '本周没有保存任何内容。这张表是空的，因为工作区里没有这段时间的内容记录。',
    taskHeaders: ['平台', '状态', '计划时间', '创建时间'],
    noTasks: '本周没有保存任何发布任务。这张表是空的，因为工作区里没有这段时间的任务记录。',
    engagementAvailable: '是否有互动数据',
    engagementNo: '没有',
    untitled: '（无标题）',
    unset: '（未填写）',
  },
  en: {
    summary: 'Summary',
    content: 'Content',
    publishing: 'Publishing',
    engagement: 'Engagement',
    title: 'Weekly workspace report',
    window: 'Window (Asia/Shanghai)',
    basis: 'Every number below is a stored record from this workspace. When nothing was stored, the sheet says so. These are not estimated views, likes, or follower changes.',
    publishTotal: 'Publish tasks',
    published: 'Published',
    failed: 'Failed',
    inProgress: 'In progress',
    manualPending: 'Waiting for a person to publish',
    manualDone: 'Published by a person',
    cancelled: 'Cancelled',
    generations: 'AI generations',
    saved: 'Saved into the library',
    approved: 'Approved or published',
    noPublish: 'No publish tasks were stored this week.',
    contentHeaders: ['Title', 'Type', 'Status', 'Created at'],
    noContent: 'No content was saved this week. This sheet is empty because the workspace has no content records in this period.',
    taskHeaders: ['Platform', 'Status', 'Scheduled at', 'Created at'],
    noTasks: 'No publish tasks were stored this week. This sheet is empty because the workspace has no task records in this period.',
    engagementAvailable: 'Engagement data available',
    engagementNo: 'No',
    untitled: '(untitled)',
    unset: '(not set)',
  },
} as const;

function stamp(value: Date | null, empty: string): string {
  if (!value) return empty;
  const time = value.getTime();
  return Number.isFinite(time) ? value.toISOString() : empty;
}

export function weeklySheets(data: WeeklyReportData): Sheet[] {
  const text = COPY[data.lang];
  const summary: Cell[][] = [
    [text.title],
    [text.window, `${data.windowStart.toISOString()} – ${data.windowEnd.toISOString()}`],
    [text.basis],
    [],
    [text.publishTotal, data.publish.total],
    [text.published, data.publish.published],
    [text.failed, data.publish.failed],
    [text.inProgress, data.publish.inProgress],
    [text.manualPending, data.publish.manualPending],
    [text.manualDone, data.publish.manualDone],
    [text.cancelled, data.publish.cancelled],
    [text.generations, data.ai.generations],
    [text.saved, data.ai.savedAsContent],
    [text.approved, data.ai.approvedOrPublished],
  ];
  for (const row of data.ai.byType) summary.push([row.label, row.count]);
  if (data.publish.total === 0) summary.push([text.noPublish]);
  if (data.truncated) {
    summary.push([data.lang === 'en' ? 'Row lists are capped at 500 stored records.' : '明细最多列出 500 条已保存记录。']);
  }

  const content: Cell[][] = [text.contentHeaders.slice()];
  if (!data.contents.length) content.push([text.noContent]);
  else {
    for (const row of data.contents) {
      content.push([
        row.title?.trim() || text.untitled,
        row.content_type,
        row.status,
        stamp(row.created_at, text.unset),
      ]);
    }
  }

  const publishing: Cell[][] = [text.taskHeaders.slice()];
  if (!data.tasks.length) publishing.push([text.noTasks]);
  else {
    for (const row of data.tasks) {
      publishing.push([
        row.platform?.trim() || text.unset,
        row.status,
        stamp(row.scheduled_at, text.unset),
        stamp(row.created_at, text.unset),
      ]);
    }
  }

  const engagement: Cell[][] = [
    [text.engagementAvailable, text.engagementNo],
    [data.engagementNote],
  ];

  return [
    { name: text.summary, rows: summary },
    { name: text.content, rows: content },
    { name: text.publishing, rows: publishing },
    { name: text.engagement, rows: engagement },
  ];
}
