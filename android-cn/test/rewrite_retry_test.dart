// 复测 B28（一键改写）：被合规检查拦下后，界面提供「按建议改写重试」，
// 并把被拦下的用语作为 avoidTerms 发给服务端；改写后仍走同一道合规检查。
import 'package:contentflow_cn/core/providers.dart';
import 'package:contentflow_cn/data/api_client.dart';
import 'package:contentflow_cn/data/api_exception.dart';
import 'package:contentflow_cn/data/models.dart';
import 'package:contentflow_cn/data/token_storage.dart';
import 'package:contentflow_cn/features/create/create_screen.dart';
import 'package:contentflow_cn/features/create/generate_status.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _hits = [
  ComplianceHit(ruleId: 'CN-AD-ART9-3', blocking: true, reason: '包含绝对化用语', matchedTerms: ['最好', '第一']),
  ComplianceHit(ruleId: 'CN-AD-ART9-4', blocking: true, reason: '国家级', matchedTerms: ['第一', '国家级']),
  ComplianceHit(ruleId: 'CN-PLATFORM-OFFSITE', blocking: false, reason: '疑似引导站外'),
];

class _Api extends ApiClient {
  _Api() : super(TokenStorage(), baseUrl: 'https://test.invalid/api/v1');
  final List<List<String>?> avoidSeen = [];

  @override
  Future<ContentPack> generateContentPack({
    required String topic,
    int titleCount = 5,
    List<String>? platforms,
    List<String>? avoidTerms,
  }) async {
    avoidSeen.add(avoidTerms);
    if (avoidTerms == null) {
      throw ApiException('内容未通过发布前合规检查', statusCode: 400, hits: _hits);
    }
    return ContentPack.fromJson({'topic': topic, 'titles': ['改写后的标题'], 'script': '改写后的正文', 'hashtags': <String>[]});
  }
}

void main() {
  testWidgets('the card offers one-click rewrite with de-duplicated blocked terms', (tester) async {
    List<String>? got;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: GenerateStatusCard(
          generating: false,
          elapsedSeconds: 0,
          error: '内容未通过发布前合规检查',
          hits: _hits,
          onRetry: () {},
          onRewrite: (t) => got = t,
        ),
      ),
    ));
    await tester.tap(find.byKey(const ValueKey('rewrite-retry')));
    expect(got, ['最好', '第一', '国家级']);
    expect(find.text('按建议改写重试'), findsOneWidget);
  });

  testWidgets('no rewrite button when nothing was blocked by name', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: GenerateStatusCard(generating: false, elapsedSeconds: 0, error: '生成失败', onRetry: () {}, onRewrite: (_) {}),
      ),
    ));
    expect(find.byKey(const ValueKey('rewrite-retry')), findsNothing);
  });

  testWidgets('tapping rewrite re-submits the same topic with avoidTerms and shows the new pack', (tester) async {
    tester.view.physicalSize = const Size(800, 3000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final api = _Api();
    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: const MaterialApp(home: Scaffold(body: CreateScreen())),
    ));
    await tester.enterText(find.byType(TextField).first, '全网最好的咖啡机');
    await tester.tap(find.text('生成内容包'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(api.avoidSeen, [null]);

    await tester.ensureVisible(find.byKey(const ValueKey('rewrite-retry')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('rewrite-retry')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(api.avoidSeen, [null, ['最好', '第一', '国家级']]);
    expect(find.byKey(const ValueKey('generate-error')), findsNothing);
    expect(find.textContaining('改写后的标题'), findsWidgets);
  });
}
