import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../data/models.dart';

/// 首页「今日重点」：只用用户自己的真实数据（草稿、发布任务、近 7 天统计），按本地日期轮换，
/// 每天换一条；没有任何数据时给出空状态，不编造内容。
class DailyFocus {
  final String kind;
  final String headline;
  final String detail;
  const DailyFocus(this.kind, this.headline, this.detail);
}

int dayNumber(DateTime now) => DateTime(now.year, now.month, now.day).difference(DateTime(1970)).inDays;

bool _isOpenTask(Schedule s) => !const {
      ScheduleStatus.draft,
      ScheduleStatus.published,
      ScheduleStatus.failed,
      ScheduleStatus.canceled,
    }.contains(s.status);

/// 候选项都来自真实数据；按「天数 % 候选数」选一条，所以同一天稳定、隔天轮换。没有候选返回 null（空状态）。
DailyFocus? pickDailyFocus({
  required List<ContentDraft> drafts,
  required List<Schedule> schedules,
  required AnalyticsOverview? overview,
  required DateTime now,
}) {
  final day = dayNumber(now);
  final today = DateTime(now.year, now.month, now.day);
  final c = <DailyFocus>[];
  if (drafts.isNotEmpty) {
    final d = drafts[day % drafts.length];
    final age = today.difference(DateTime(d.createdAt.year, d.createdAt.month, d.createdAt.day)).inDays;
    final title = d.title.trim().isEmpty ? '（无标题草稿）' : d.title.trim();
    c.add(DailyFocus('draft', '回看一篇草稿', '《$title》${age <= 0 ? '今天创建' : '创建于 $age 天前'}，今天改一改就可以发布。你共有 ${drafts.length} 篇草稿。'));
  }
  final open = schedules.where((s) {
    final t = s.publishTime.toLocal();
    return _isOpenTask(s) && DateTime(t.year, t.month, t.day) == today;
  }).length;
  if (open > 0) c.add(DailyFocus('tasks', '今天有 $open 条发布任务', '到点前确认内容和平台，别错过发布时间。'));
  final w = overview?.week.publish;
  if (w != null && (w.published > 0 || w.failed > 0)) {
    c.add(DailyFocus('week', '近 7 天发布情况', '已发布 ${w.published} 条，失败 ${w.failed} 条。${w.failed > 0 ? '先看看失败原因再重试。' : '保持节奏。'}'));
  }
  final fr = overview?.failureReasons ?? const <FailureReason>[];
  if (fr.isNotEmpty && fr.first.reason.trim().isNotEmpty) {
    c.add(DailyFocus('failure', '最近最常见的失败原因', '${fr.first.reason}（${fr.first.count} 次）。解决它，发布成功率会更高。'));
  }
  final g = overview?.week.ai.generations ?? 0;
  if (g > 0) {
    final saved = overview!.week.ai.savedAsContent;
    c.add(DailyFocus('ai', '近 7 天的创作', '生成了 $g 次内容包，其中 $saved 次保存为内容。'));
  }
  if (c.isEmpty) return null;
  return c[day % c.length];
}

class DailyFocusCard extends ConsumerWidget {
  /// 测试里注入固定日期。
  final DateTime Function()? clock;
  const DailyFocusCard({super.key, this.clock});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final drafts = ref.watch(contentDraftsProvider);
    final schedules = ref.watch(todaySchedulesProvider);
    final overview = ref.watch(analyticsOverviewProvider);
    final brief = ref.watch(homeBriefProvider);
    final all = [drafts, schedules, overview, brief];
    final loading = all.any((a) => a.isLoading && !a.hasValue);
    final allFailed = all.every((a) => a.hasError);
    Widget body;
    if (loading) {
      body = const Padding(padding: EdgeInsets.all(8), child: LinearProgressIndicator());
    } else if (allFailed) {
      body = const Text('今日重点暂时没能加载，下拉页面可以重试。', style: TextStyle(fontSize: 13, color: Colors.grey));
    } else {
      final focus = pickDailyFocus(
        drafts: drafts.valueOrNull ?? const [],
        schedules: schedules.valueOrNull ?? const [],
        overview: overview.valueOrNull,
        now: (clock ?? DateTime.now)(),
      );
      final home = brief.valueOrNull ?? HomeBrief.empty;
      final extras = <Widget>[
        if (home.suggestions.isNotEmpty) ...[
          const SizedBox(height: 12),
          const Text('按你的注册资料', key: ValueKey('home-suggestions'), style: TextStyle(fontSize: 12, color: Colors.grey)),
          for (final item in home.suggestions) ...[
            const SizedBox(height: 6),
            Text(item.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            if (item.reason.isNotEmpty) Text(item.reason, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          ],
        ],
        if (home.pending.isNotEmpty) ...[
          const SizedBox(height: 12),
          const Text('待审核', key: ValueKey('home-pending'), style: TextStyle(fontSize: 12, color: Colors.grey)),
          for (final item in home.pending) ...[
            const SizedBox(height: 4),
            Text(item.title, style: const TextStyle(fontSize: 14)),
          ],
        ],
      ];
      if (focus == null) {
        body = Column(
          key: const ValueKey('daily-focus-empty'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('还没有你的内容活动', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(
              home.suggestions.isEmpty
                  ? '先到「创作」生成一个内容包并保存。之后这里每天会根据你的草稿和发布记录，给出一条今日重点。'
                  : '还没有草稿和发布记录。下面是按你注册时填写的资料给出的选题，不是外部热点。',
              style: const TextStyle(fontSize: 13, color: Colors.black54),
            ),
            ...extras,
          ],
        );
      } else {
        body = Column(
          key: ValueKey('daily-focus-${focus.kind}'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(focus.headline, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(focus.detail, style: const TextStyle(fontSize: 13, color: Colors.black87)),
            ...extras,
          ],
        );
      }
    }
    return Container(
      key: const ValueKey('daily-focus'),
      margin: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).primaryColor.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.today_outlined, size: 18, color: Theme.of(context).primaryColor),
            const SizedBox(width: 6),
            const Text('今日重点', style: TextStyle(fontSize: 12, color: Colors.grey)),
          ]),
          const SizedBox(height: 8),
          body,
        ],
      ),
    );
  }
}
