import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_global/core/providers.dart';
import 'package:contentflow_global/data/api_client.dart';
import 'package:contentflow_global/data/models.dart';
import 'package:contentflow_global/features/create/create_screen.dart';
import 'package:contentflow_global/features/create/market_options.dart';

class _FakeApi implements ApiClient {
  String? market;
  String? material;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<ContentPack> generateContentPack({
    required String topic,
    int titleCount = 5,
    String? targetMarket,
    String? material,
    List<String>? platforms,
  }) async {
    market = targetMarket;
    this.material = material;
    return ContentPack.fromJson({
      'titles': ['A title'],
      'script': 'Body',
      'target_market': 'UK',
      'disclosure_hint': {
        'marketName': 'United Kingdom',
        'labelExamples': ['Ad', 'Advert'],
        'avoid': ['"sponsored" on its own'],
        'placement': 'Prominent and upfront.',
        'sources': [
          {'name': 'ASA, Recognising ads', 'url': 'https://www.asa.org.uk/'},
        ],
      },
      'grounding': {
        'material_supplied': true,
        'supported_by_material': ['24%'],
        'unverified': ['NOVAGRIP'],
        'notice':
            '"Supported" only means the figure appears in the material you supplied.',
      },
      'compliance': {
        'rules_checked': 12,
        'hit_counts': {'block': 0, 'review': 1, 'total': 1},
        'not_checked': ['Copyright'],
        'disclaimer': 'This is not legal advice.',
      },
      'positioning_used': {
        'persona': false,
        'persona_name': null,
        'top_titles': 0,
        'reference_only': true,
      },
    });
  }
}

bool _cjk(WidgetTester t) => RegExp(r'[\u3400-\u9fff]').hasMatch(
  t.widgetList<Text>(find.byType(Text)).map((x) => x.data ?? '').join(' '),
);

void main() {
  testWidgets('offers only sourced markets (Singapore, no "Southeast Asia")', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TargetMarketField(value: '', onChanged: (_) {}),
        ),
      ),
    );
    await tester.tap(find.byKey(const ValueKey('target-market')));
    await tester.pumpAndSettle();
    for (final name in [
      'United States',
      'United Kingdom',
      'India',
      'Singapore',
    ]) {
      expect(find.text(name), findsWidgets);
    }
    expect(find.textContaining('Southeast'), findsNothing);
  });

  testWidgets(
    'create screen sends the chosen market and material, then shows what the server did',
    (tester) async {
      tester.view.physicalSize = const Size(900, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      final api = _FakeApi();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [apiClientProvider.overrideWithValue(api)],
          child: const MaterialApp(home: CreateScreen()),
        ),
      );
      await tester.enterText(find.byType(TextField).first, 'desk lamp');
      await tester.enterText(
        find.byKey(const ValueKey('brand-material')),
        'AQUAPURE datasheet 24%',
      );
      await tester.tap(find.byKey(const ValueKey('target-market')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('United Kingdom').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Generate content pack'));
      await tester.pumpAndSettle();
      expect(api.market, 'UK');
      expect(api.material, 'AQUAPURE datasheet 24%');
      expect(find.text('Ad disclosure for United Kingdom'), findsOneWidget);
      expect(
        find.textContaining('Acceptable wording: Ad, Advert'),
        findsOneWidget,
      );
      expect(
        find.textContaining('Found in your material: 24%'),
        findsOneWidget,
      );
      expect(
        find.textContaining('Not found in your topic or material: NOVAGRIP'),
        findsOneWidget,
      );
      expect(
        find.text('12 rules checked: 0 blocking, 1 to review.'),
        findsOneWidget,
      );
      expect(find.textContaining('not personalised'), findsOneWidget);
      expect(_cjk(tester), isFalse);
    },
  );

  testWidgets('without options nothing is sent and no market is invented', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(900, 3200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final api = _FakeApi();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(api)],
        child: const MaterialApp(home: CreateScreen()),
      ),
    );
    await tester.enterText(find.byType(TextField).first, 'desk lamp');
    await tester.tap(find.text('Generate content pack'));
    await tester.pumpAndSettle();
    expect(api.market ?? '', isEmpty);
    expect(api.material ?? '', isEmpty);
  });
}
