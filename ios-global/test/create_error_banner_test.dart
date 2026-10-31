import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_global/core/providers.dart';
import 'package:contentflow_global/data/api_client.dart';
import 'package:contentflow_global/data/api_exception.dart';
import 'package:contentflow_global/data/models.dart';
import 'package:contentflow_global/data/token_storage.dart';
import 'package:contentflow_global/features/create/create_screen.dart';

class _FailingApi extends ApiClient {
  _FailingApi() : super(TokenStorage());

  int calls = 0;

  @override
  Future<ContentPack> generateContentPack({required String topic}) async {
    calls++;
    throw ApiException(ApiException.statusMessage(400), statusCode: 400);
  }
}

void main() {
  test('status 400 maps to a readable message in the right language', () {
    expect(ApiException.statusMessage(400), contains('The request was not accepted'));
    expect(ApiException.statusMessage(500), isNot(contains('500')));
  });

  testWidgets('a failed generation leaves a visible error and a retry button on screen', (tester) async {
    final api = _FailingApi();
    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: const MaterialApp(home: Scaffold(body: CreateScreen())),
    ));
    await tester.enterText(find.byType(TextField).first, 'desk setup');
    await tester.tap(find.text('Generate content pack'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byKey(const Key('create_error_banner')), findsOneWidget);
    expect(find.text('Generation failed'), findsOneWidget);
    expect(find.textContaining('The request was not accepted'), findsWidgets);
    expect(api.calls, 1);

    await tester.tap(find.text('Try again'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(api.calls, 2);
  });
}
