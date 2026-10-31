import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_cn/core/providers.dart';
import 'package:contentflow_cn/data/api_client.dart';
import 'package:contentflow_cn/data/api_exception.dart';
import 'package:contentflow_cn/data/models.dart';
import 'package:contentflow_cn/data/token_storage.dart';
import 'package:contentflow_cn/features/create/create_screen.dart';

class _FailingApi extends ApiClient {
  _FailingApi() : super(TokenStorage());

  int calls = 0;

  @override
  Future<ContentPack> generateContentPack({
    required String topic,
    int titleCount = 5,
    List<String>? platforms,
  }) async {
    calls++;
    throw ApiException(ApiException.statusMessage(400), statusCode: 400);
  }
}

void main() {
  test('status 400 maps to a readable message in the right language', () {
    expect(ApiException.statusMessage(400), contains('提交的内容不符合要求'));
    expect(ApiException.statusMessage(500), isNot(contains('500')));
  });

  testWidgets('a failed generation leaves a visible error and a retry button on screen', (tester) async {
    tester.view.physicalSize = const Size(800, 3000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final api = _FailingApi();
    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: const MaterialApp(home: Scaffold(body: CreateScreen())),
    ));
    await tester.enterText(find.byType(TextField).first, 'desk setup');
    await tester.tap(find.text('生成内容包'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byKey(const ValueKey('generate-error')), findsOneWidget);
    expect(find.text('生成没有完成'), findsOneWidget);
    expect(find.textContaining('提交的内容不符合要求'), findsWidgets);
    expect(api.calls, 1);

    await tester.tap(find.text('重新生成'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(api.calls, 2);
  });
}
