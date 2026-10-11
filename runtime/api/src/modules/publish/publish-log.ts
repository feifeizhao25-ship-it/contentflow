/**
 * 发布中心的筛选、批量重试与「导出日志」。
 *
 * 原来发布中心顶部的搜索框、平台 / 状态 / 日期筛选、「批量重试」「导出日志」都只是摆设：
 * 没有绑定任何事件，后端列表接口也只认 status。这里把筛选条件集中解析成 Prisma 查询，
 * 列表、批量重试、导出三处共用，保证「看到的」和「导出的」是同一批任务。
 *
 * 导出只包含当前工作区（tenant_id）自己的发布任务，表头为中文，按北京时间显示时间。
 */
import { BadRequestException } from '@nestjs/common';
import { chinaDayStart } from '../../common/china-period';

export const PUBLISH_PLATFORM_NAMES: Record<string, string> = {
  douyin: '抖音',
  bilibili: 'B站',
  xhs: '小红书',
  weixin: '视频号',
  wechat_mp: '公众号',
  weibo: '微博',
  kuaishou: '快手',
};

export const PUBLISH_STATUS_NAMES: Record<string, string> = {
  pending: '待发布',
  queued: '队列中',
  processing: '发布中',
  submitted: '平台审核中',
  submitted_unconfirmed: '已提交待平台确认',
  published: '发布成功',
  failed: '发布失败',
  cancelled: '已取消',
  manual_pending: '待人工发布',
  manual_done: '已人工发布',
};

/** 平台中文名；不认识的代码不把英文原值上屏。 */
export function publishPlatformName(code: unknown): string {
  return PUBLISH_PLATFORM_NAMES[String(code ?? '')] ?? '该平台';
}

const MANUAL_CAPABLE = new Set(['xhs', 'weixin', 'wechat_mp']);

/**
 * 自动发布通道不可用时给用户的原因 + 能怎么做（原来是「平台 douyin 尚未完成真实开放平台接入」，
 * 英文平台代码上屏、也不告诉用户下一步）。
 */
export function channelUnavailableReason(
  code: unknown,
  kind: 'not_live' | 'no_adapter' | 'no_account',
  action: 'retry' | 'create',
): string {
  const name = publishPlatformName(code);
  const verb = action === 'retry' ? '重试' : '创建自动发布任务';
  if (kind === 'no_account') {
    return `这条任务没有绑定平台账号，不能${verb}。可以取消这条任务，到内容库点「发布」重新创建（小红书、视频号、公众号走人工确认发布）。`;
  }
  if (MANUAL_CAPABLE.has(String(code))) {
    return `${name}不支持自动发布，不能${verb}。可以取消这条任务，到内容库点「发布」改用人工确认发布（复制文案、下载带 AI 标识的封面后自己发）。`;
  }
  if (kind === 'not_live') {
    return `${name}自动发布还没有开通（开放平台接入未完成），不能${verb}。可以取消这条任务，先在${name} App 或创作者中心自己发布。`;
  }
  return `${name}暂不支持自动发布，不能${verb}。可以取消这条任务，先在${name} App 或创作者中心自己发布。`;
}

/** 界面上的状态分组 → 实际状态。 */
export const PUBLISH_STATUS_GROUPS: Record<string, string[]> = {
  success: ['published', 'manual_done'],
  in_progress: ['pending', 'queued', 'processing', 'submitted', 'submitted_unconfirmed'],
  failed: ['failed'],
  manual_pending: ['manual_pending'],
  manual_done: ['manual_done'],
  cancelled: ['cancelled'],
};

export interface PublishTaskFilter {
  statuses?: string[];
  platforms?: string[];
  keyword?: string;
  /** 北京时间当天 0 点（含） */
  from?: Date;
  /** 北京时间次日 0 点（不含） */
  to?: Date;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function splitList(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))];
}

function beijingDay(raw: string, field: string): Date {
  if (!DATE_RE.test(raw)) throw new BadRequestException(`${field}格式应为 年-月-日，例如 2026-10-07`);
  const day = new Date(`${raw}T00:00:00+08:00`);
  // 2026-02-30 之类会被 Date 顺延到下个月：换回北京日期比对，不一致就是无效日期
  if (Number.isNaN(day.getTime()) || beijingTime(day).slice(0, 10) !== raw) throw new BadRequestException(`${field}不是有效日期`);
  return chinaDayStart(day);
}

/** 解析查询串里的筛选条件；不认识的平台、状态直接 400，而不是悄悄忽略。 */
export function parsePublishTaskFilter(query: {
  status?: unknown;
  platform?: unknown;
  keyword?: unknown;
  from?: unknown;
  to?: unknown;
}): PublishTaskFilter {
  const filter: PublishTaskFilter = {};

  const statusTokens = splitList(query.status).filter((s) => s !== 'all');
  if (statusTokens.length) {
    const statuses = new Set<string>();
    for (const token of statusTokens) {
      if (PUBLISH_STATUS_GROUPS[token]) PUBLISH_STATUS_GROUPS[token].forEach((s) => statuses.add(s));
      else if (PUBLISH_STATUS_NAMES[token]) statuses.add(token);
      else throw new BadRequestException('不认识的任务状态筛选');
    }
    filter.statuses = [...statuses];
  }

  const platforms = splitList(query.platform);
  if (platforms.length) {
    if (platforms.some((p) => !PUBLISH_PLATFORM_NAMES[p])) throw new BadRequestException('不认识的平台筛选');
    filter.platforms = platforms;
  }

  const keyword = typeof query.keyword === 'string' ? query.keyword.trim() : '';
  if (keyword) {
    if (keyword.length > 100) throw new BadRequestException('搜索词不能超过 100 个字');
    filter.keyword = keyword;
  }

  if (typeof query.from === 'string' && query.from.trim()) filter.from = beijingDay(query.from.trim(), '开始日期');
  if (typeof query.to === 'string' && query.to.trim()) {
    filter.to = new Date(beijingDay(query.to.trim(), '结束日期').getTime() + 24 * 60 * 60 * 1000);
  }
  if (filter.from && filter.to && filter.from >= filter.to) throw new BadRequestException('开始日期不能晚于结束日期');
  return filter;
}

/** 筛选条件 → Prisma where。tenant_id 永远由服务端给定，不接受客户端。 */
export function publishTaskWhere(tenantId: string, filter: PublishTaskFilter): Record<string, any> {
  const and: any[] = [];
  if (filter.statuses?.length) and.push({ status: { in: filter.statuses } });
  if (filter.platforms?.length) {
    and.push({
      OR: [
        { platform_account: { platform: { in: filter.platforms } } },
        { platform_content: { platform: { in: filter.platforms } } },
      ],
    });
  }
  if (filter.keyword) and.push({ content: { title: { contains: filter.keyword, mode: 'insensitive' } } });
  if (filter.from || filter.to) {
    const range: any = {};
    if (filter.from) range.gte = filter.from;
    if (filter.to) range.lt = filter.to;
    // 任务卡片上显示的是计划时间；没有计划时间的按创建时间算
    and.push({ OR: [{ scheduled_at: range }, { scheduled_at: null, created_at: range }] });
  }
  return and.length ? { tenant_id: tenantId, AND: and } : { tenant_id: tenantId };
}

// ───────────────────────── CSV ─────────────────────────

export const PUBLISH_LOG_HEADERS = [
  '任务编号',
  '内容标题',
  '平台',
  '发布账号',
  '发布方式',
  '状态',
  '计划时间',
  '完成时间',
  '作品链接',
  '失败原因',
  '错误码',
  '重试次数',
  '创建时间',
] as const;

/** 导出上限：再多请缩小日期范围分批导出。 */
export const PUBLISH_LOG_MAX_ROWS = 5000;

function beijingTime(value: unknown): string {
  if (!value) return '';
  const d = new Date(value as any);
  if (Number.isNaN(d.getTime())) return '';
  const b = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())} ${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`;
}

/**
 * 单元格转义：含逗号、引号、换行时加引号；以 = + - @ 制表符 回车 开头的
 * 前面加单引号，防止用 Excel / WPS 打开时被当成公式执行（CSV 注入）。
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function publishTaskToRow(task: any): string[] {
  const platform = task.platform_account?.platform || task.platform_content?.platform || '';
  const manual = task.publish_type === 'manual';
  return [
    task.id,
    task.content?.title || '未命名内容',
    PUBLISH_PLATFORM_NAMES[platform] || '未知平台',
    task.platform_account
      ? task.platform_account.account_nickname || task.platform_account.account_name || '已授权账号'
      : manual ? '人工发布（无绑定账号）' : '未绑定账号',
    manual ? '人工确认发布' : task.publish_type === 'scheduled' ? '定时自动发布' : '自动发布',
    PUBLISH_STATUS_NAMES[task.status] || '未知状态',
    beijingTime(task.scheduled_at),
    beijingTime(task.completed_at),
    task.platform_post_url || '',
    // 失败原因只导出中文说明；英文原文（第三方返回）不导出，避免把供应商原文带出去
    typeof task.error_message === 'string' && /[一-鿿]/.test(task.error_message) ? task.error_message : task.error_message ? '平台未返回可识别的中文说明' : '',
    task.error_code || '',
    String(task.retry_count ?? 0),
    beijingTime(task.created_at),
  ];
}

/** 带 UTF-8 BOM，Excel / WPS 直接打开不乱码。 */
export function publishTasksToCsv(tasks: any[]): string {
  const lines = [PUBLISH_LOG_HEADERS.map(csvCell).join(',')];
  for (const task of tasks) lines.push(publishTaskToRow(task).map(csvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function publishLogFileName(now = new Date()): { ascii: string; utf8: string } {
  const day = beijingTime(now).slice(0, 10).replace(/-/g, '');
  return { ascii: `publish-log-${day}.csv`, utf8: `发布记录-${day}.csv` };
}
