import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_cn/core/providers.dart';
import 'package:contentflow_cn/data/models.dart';
import 'package:contentflow_cn/features/insights/overview_section.dart';

const _json = <String, dynamic>{
  'week': {
    'publish': {'total': 9, 'published': 2, 'failed': 3, 'inProgress': 1, 'manualPending': 2, 'manualDone': 1, 'cancelled': 0},
    'ai': {
      'generations': 10,
      'byType': [
        {'type': 'titles', 'label': '标题', 'count': 6},
      ],
      'savedAsContent': 3,
      'approvedOrPublished': 1,
    },
  },
  'month': {
    'publish': {'total': 0},
    'ai': {'generations': 0, 'byType': []},
  },
  'failureReasons': [
    {'reason': '该平台尚未完成开放平台接入', 'count': 2},
  ],
  'engagement': {'available': false, 'message': '接通平台授权后显示', 'detail': 'detail text'},
};

Future<void> _pump(WidgetTester tester, AnalyticsOverview overview) async {
  tester.view.physicalSize = const Size(900, 3200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [analyticsOverviewProvider.overrideWith((ref) async => overview)],
    child: const MaterialApp(home: Scaffold(body: SingleChildScrollView(child: OverviewSection()))),
  ));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 200));
}

void main() {
  test('parses the server overview as it is, and tolerates missing fields', () {
    final o = AnalyticsOverview.fromJson(_json);
    expect(o.week.publish.published, 2);
    expect(o.week.publish.manualDone, 1);
    expect(o.week.ai.byType.single.count, 6);
    expect(o.failureReasons.single.count, 2);
    expect(o.engagementAvailable, false);
    final empty = AnalyticsOverview.fromJson(const <String, dynamic>{});
    expect(empty.week.publish.total, 0);
    expect(empty.failureReasons, isEmpty);
    expect(empty.engagementMessage, '');
  });

  testWidgets('shows real counts for the week, the real failure reason, and the no-engagement note', (tester) async {
    await _pump(tester, AnalyticsOverview.fromJson(_json));
    expect(find.text('本周'), findsOneWidget);
    expect(find.text('已发布'), findsWidgets);
    expect(find.text('3'), findsWidgets); // failed
    expect(find.text('10'), findsOneWidget); // AI generations
    expect(find.text('该平台尚未完成开放平台接入'), findsOneWidget);
    expect(find.textContaining('接通平台授权后显示'), findsOneWidget);
    expect(find.text('detail text'), findsOneWidget);
  });

  testWidgets('a period without tasks shows the empty state, not zeros', (tester) async {
    await _pump(tester, AnalyticsOverview.fromJson(_json));
    await tester.tap(find.text('本月'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('这段时间还没有发布任务'), findsOneWidget);
  });
}
