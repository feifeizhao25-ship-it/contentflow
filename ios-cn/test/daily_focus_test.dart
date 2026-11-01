// 首页「今日重点」：按真实数据每天轮换，没有数据时是空状态。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_cn/core/providers.dart';
import 'package:contentflow_cn/data/models.dart';
import 'package:contentflow_cn/features/today/daily_focus.dart';

ContentDraft _draft(String id, String title, DateTime at) =>
    ContentDraft(id: id, title: title, body: 'b', source: 'ai', status: 'draft', createdAt: at);

AnalyticsOverview _overview({int published = 0, int failed = 0, int gens = 0}) => AnalyticsOverview.fromJson({
      'week': {
        'publish': {'total': published + failed, 'published': published, 'failed': failed},
        'ai': {'generations': gens, 'savedAsContent': gens > 0 ? 1 : 0},
      },
      'month': {},
      'failureReasons': failed > 0 ? [{'reason': 'token expired', 'count': failed}] : [],
    });

void main() {
  test('no data at all -> null (empty state), never an invented suggestion', () {
    expect(pickDailyFocus(drafts: const [], schedules: const [], overview: null, now: DateTime(2026, 11, 1)), isNull);
    expect(pickDailyFocus(drafts: const [], schedules: const [], overview: _overview(), now: DateTime(2026, 11, 1)), isNull);
  });

  test('the pick changes from day to day and is stable within a day, and always comes from real data', () {
    final drafts = [for (var i = 0; i < 5; i++) _draft('$i', 'Draft $i', DateTime(2026, 10, 20 + i))];
    final ov = _overview(published: 3, failed: 1, gens: 2);
    final seen = <String>{};
    for (var d = 0; d < 10; d++) {
      final now = DateTime(2026, 11, 1 + d, 9);
      final a = pickDailyFocus(drafts: drafts, schedules: const [], overview: ov, now: now)!;
      final b = pickDailyFocus(drafts: drafts, schedules: const [], overview: ov, now: DateTime(2026, 11, 1 + d, 22))!;
      expect(a.headline + a.detail, b.headline + b.detail);
      seen.add(a.headline + a.detail);
      if (a.kind == 'draft') expect(drafts.any((x) => a.detail.contains(x.title)), isTrue);
      if (a.kind == 'week') expect(a.detail, contains('3'));
    }
    expect(seen.length, greaterThan(3));
  });

  testWidgets('card shows the empty state when the account has no activity', (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        contentDraftsProvider.overrideWith((ref) async => <ContentDraft>[]),
        todaySchedulesProvider.overrideWith((ref) async => <Schedule>[]),
        analyticsOverviewProvider.overrideWith((ref) async => _overview()),
      ],
      child: MaterialApp(home: Scaffold(body: DailyFocusCard(clock: () => DateTime(2026, 11, 1)))),
    ));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('daily-focus-empty')), findsOneWidget);
  });

  testWidgets('card shows a real draft title and a different focus the next day', (tester) async {
    var now = DateTime(2026, 11, 1);
    final drafts = [_draft('1', 'Autumn latte launch', DateTime(2026, 10, 30))];
    Future<void> pump() async {
      await tester.pumpWidget(ProviderScope(
        key: UniqueKey(),
        overrides: [
          contentDraftsProvider.overrideWith((ref) async => drafts),
          todaySchedulesProvider.overrideWith((ref) async => <Schedule>[]),
          analyticsOverviewProvider.overrideWith((ref) async => _overview(published: 4, failed: 0)),
        ],
        child: MaterialApp(home: Scaffold(body: DailyFocusCard(clock: () => now))),
      ));
      await tester.pumpAndSettle();
    }
    await pump();
    final first = find.byWidgetPredicate((w) => w.key is ValueKey && (w.key as ValueKey).value.toString().startsWith('daily-focus-'));
    final k1 = (tester.widget(first.first).key as ValueKey).value;
    now = DateTime(2026, 11, 2);
    await pump();
    final k2 = (tester.widget(first.first).key as ValueKey).value;
    expect(k1, isNot(k2));
  });
}
