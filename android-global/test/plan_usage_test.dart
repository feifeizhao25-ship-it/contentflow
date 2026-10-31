import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_global/data/subscription_status.dart';
import 'package:contentflow_global/data/models.dart';
import 'package:contentflow_global/core/providers.dart';
import 'package:contentflow_global/features/account/account_screen.dart';
import 'package:contentflow_global/features/account/plan_usage_screen.dart';

Map<String, dynamic> _json({
  String plan = 'pro',
  int limit = 1000,
  int used = 250,
  bool unlimited = false,
  String quotaStatus = 'confirmed',
  bool expired = false,
  String? notice,
  String? renewal,
}) => {
  'plan': plan,
  'quotaStatus': quotaStatus,
  'aiTokens': {
    'limit': limit,
    'used': used,
    'reserved': 0,
    'remaining': unlimited ? -1 : (limit - used),
    'unlimited': unlimited,
    'imageTokenEquivalent': 2000,
  },
  'renewalDate': renewal,
  'renewalNotice': notice,
  'expired': expired,
  'limits': {
    'max_accounts': 10,
    'max_publishes_monthly': 200,
    'max_members': 1,
    'max_storage_gb': 5,
  },
  'period': '2026-10',
};

Widget _app(Widget child, Object result) => ProviderScope(
  overrides: [
    subscriptionStatusProvider.overrideWith((ref) async {
      if (result is Exception) throw result;
      return SubscriptionStatus.fromJson(result as Map<String, dynamic>);
    }),
  ],
  child: MaterialApp(home: child),
);

bool _hasCjk(WidgetTester tester) {
  final texts = tester
      .widgetList<Text>(find.byType(Text))
      .map((t) => t.data ?? '')
      .join(' ');
  return RegExp(r'[\u3400-\u9fff]').hasMatch(texts);
}

void main() {
  test(
    'parses the server shape and never invents a fraction for unlimited or zero limits',
    () {
      final s = SubscriptionStatus.fromJson(_json(limit: 1000, used: 250));
      expect(s.aiTokens.fraction, 0.25);
      expect(
        SubscriptionStatus.fromJson(
          _json(unlimited: true, limit: -1),
        ).aiTokens.fraction,
        isNull,
      );
      expect(
        SubscriptionStatus.fromJson(_json(limit: 0, used: 5)).aiTokens.fraction,
        isNull,
      );
      expect(
        SubscriptionStatus.fromJson(
          _json(limit: 100, used: 500),
        ).aiTokens.fraction,
        1.0,
      );
      expect(SubscriptionStatus.fromJson(const {}).plan, 'free');
    },
  );

  testWidgets('shows plan, real AI usage and limits from the server', (
    tester,
  ) async {
    await tester.pumpWidget(_app(const PlanUsageScreen(), _json()));
    await tester.pumpAndSettle();
    expect(find.text('Plan & usage'), findsOneWidget);
    expect(find.text('250 of 1,000 tokens used this month'), findsWidgets);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(
      tester
          .widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator))
          .value,
      0.25,
    );
    expect(find.text('Pro'), findsOneWidget);
    expect(_hasCjk(tester), isFalse);
  });

  testWidgets('unlimited plan shows no bar', (tester) async {
    await tester.pumpWidget(
      _app(
        const PlanUsageScreen(),
        _json(plan: 'enterprise', unlimited: true, limit: -1, used: 12345),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(find.text('Unlimited'), findsWidgets);
  });

  testWidgets('unconfirmed quota is shown as pending, not as a number', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        const PlanUsageScreen(),
        _json(
          plan: 'enterprise',
          quotaStatus: 'unconfirmed',
          limit: 40000000,
          used: 10,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(find.text('Quota pending confirmation'), findsOneWidget);
    expect(find.textContaining('40,000,000'), findsNothing);
  });

  testWidgets('expired plan says the free limits apply', (tester) async {
    await tester.pumpWidget(
      _app(const PlanUsageScreen(), _json(plan: 'free', expired: true)),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('Your plan has expired; the free limits apply.'),
      findsOneWidget,
    );
  });

  testWidgets('load failure shows a retry button, not made-up numbers', (
    tester,
  ) async {
    await tester.pumpWidget(_app(const PlanUsageScreen(), Exception('boom')));
    await tester.pumpAndSettle();
    expect(
      find.text('Could not load your plan and usage. Please try again.'),
      findsOneWidget,
    );
    expect(find.text('Retry'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);
  });

  testWidgets(
    'account screen shows the real card and no placeholder usage bars',
    (tester) async {
      tester.view.physicalSize = const Size(900, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            subscriptionStatusProvider.overrideWith(
              (ref) async => SubscriptionStatus.fromJson(_json()),
            ),
            userProvider.overrideWith(
              (ref) async => User(
                id: 'u',
                name: 'Ada',
                plan: 'pro',
                apiUsage: 0,
                apiLimit: 1000,
                storageUsage: 0,
                storageLimit: 500,
              ),
            ),
          ],
          child: const MaterialApp(home: AccountScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(PlanUsageCard), findsOneWidget);
      expect(find.text('250 of 1,000 tokens used this month'), findsOneWidget);
      expect(find.textContaining('MB/'), findsNothing);
      await tester.tap(find.byType(PlanUsageCard));
      await tester.pumpAndSettle();
      expect(find.byType(PlanUsageScreen), findsOneWidget);
    },
  );
}
