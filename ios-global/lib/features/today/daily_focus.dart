import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../data/models.dart';

/// Home "Today's focus": only the user's own real data (drafts, publishing tasks, last-7-day stats), rotated by
/// local date so it changes daily; shows an empty state when there is no data. Nothing is invented.
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

/// Candidates come from real data; one is chosen by day % count: stable within a day, rotating daily. null = empty state.
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
    final title = d.title.trim().isEmpty ? '(untitled draft)' : d.title.trim();
    c.add(DailyFocus('draft', 'Revisit a draft', '"$title" ${age <= 0 ? 'was created today' : 'was created $age day${age == 1 ? '' : 's'} ago'}. A quick edit and it can go out today. You have ${drafts.length} draft${drafts.length == 1 ? '' : 's'} in total.'));
  }
  final open = schedules.where((s) {
    final t = s.publishTime.toLocal();
    return _isOpenTask(s) && DateTime(t.year, t.month, t.day) == today;
  }).length;
  if (open > 0) c.add(DailyFocus('tasks', '$open publishing task${open == 1 ? '' : 's'} today', 'Check the content and platform before the scheduled time.'));
  final w = overview?.week.publish;
  if (w != null && (w.published > 0 || w.failed > 0)) {
    c.add(DailyFocus('week', 'Publishing, last 7 days', '${w.published} published, ${w.failed} failed. ${w.failed > 0 ? 'Check the failure reason before retrying.' : 'Keep the rhythm.'}'));
  }
  final fr = overview?.failureReasons ?? const <FailureReason>[];
  if (fr.isNotEmpty && fr.first.reason.trim().isNotEmpty) {
    c.add(DailyFocus('failure', 'Most common recent failure', '${fr.first.reason} (${fr.first.count}x). Fixing it will raise your publish rate.'));
  }
  final g = overview?.week.ai.generations ?? 0;
  if (g > 0) {
    final saved = overview!.week.ai.savedAsContent;
    c.add(DailyFocus('ai', 'Creating, last 7 days', 'Generated $g content pack${g == 1 ? '' : 's'}, $saved saved as content.'));
  }
  if (c.isEmpty) return null;
  return c[day % c.length];
}

class DailyFocusCard extends ConsumerWidget {
  /// Inject a fixed date in tests.
  final DateTime Function()? clock;
  const DailyFocusCard({super.key, this.clock});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final drafts = ref.watch(contentDraftsProvider);
    final schedules = ref.watch(todaySchedulesProvider);
    final overview = ref.watch(analyticsOverviewProvider);
    final all = [drafts, schedules, overview];
    final loading = all.any((a) => a.isLoading && !a.hasValue);
    final allFailed = all.every((a) => a.hasError);
    Widget body;
    if (loading) {
      body = const Padding(padding: EdgeInsets.all(8), child: LinearProgressIndicator());
    } else if (allFailed) {
      body = const Text('Today\'s focus could not be loaded. Pull down to retry.', style: TextStyle(fontSize: 13, color: Colors.grey));
    } else {
      final focus = pickDailyFocus(
        drafts: drafts.valueOrNull ?? const [],
        schedules: schedules.valueOrNull ?? const [],
        overview: overview.valueOrNull,
        now: (clock ?? DateTime.now)(),
      );
      if (focus == null) {
        body = const Column(
          key: ValueKey('daily-focus-empty'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('No activity of yours yet', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            SizedBox(height: 4),
            Text('Generate a content pack in Create and save it. After that this card shows one focus a day, based on your drafts and publishing record.', style: TextStyle(fontSize: 13, color: Colors.black54)),
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
            const Text('Today\'s focus', style: TextStyle(fontSize: 12, color: Colors.grey)),
          ]),
          const SizedBox(height: 8),
          body,
        ],
      ),
    );
  }
}
