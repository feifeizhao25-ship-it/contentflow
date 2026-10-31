import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:contentflow_global/data/api_exception.dart';
import 'package:contentflow_global/features/create/generate_status.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: Padding(padding: const EdgeInsets.all(16), child: child)));

void main() {
  testWidgets('shows visible progress with elapsed seconds while generating', (tester) async {
    await tester.pumpWidget(_wrap(GenerateStatusCard(generating: true, elapsedSeconds: 7, error: null, onRetry: () {})));
    expect(find.text('Generating your content pack…'), findsOneWidget);
    expect(find.text('7s elapsed'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.textContaining('under a minute'), findsOneWidget);
  });

  testWidgets('shows the error with a retry button that fires', (tester) async {
    var retried = 0;
    await tester.pumpWidget(_wrap(GenerateStatusCard(generating: false, elapsedSeconds: 0, error: 'Generation took too long and was stopped.', onRetry: () => retried++)));
    expect(find.text('Generation did not finish'), findsOneWidget);
    expect(find.text('Generation took too long and was stopped.'), findsOneWidget);
    await tester.tap(find.text('Try again'));
    expect(retried, 1);
  });

  testWidgets('renders nothing when idle and there is no error', (tester) async {
    await tester.pumpWidget(_wrap(GenerateStatusCard(generating: false, elapsedSeconds: 0, error: null, onRetry: () {})));
    expect(find.byType(OutlinedButton), findsNothing);
    expect(find.byType(LinearProgressIndicator), findsNothing);
  });

  test('a Dio receive timeout is flagged as timedOut so the screen can explain it', () {
    final e = ApiException.fromDio(DioException(requestOptions: RequestOptions(path: '/content-pack/generate'), type: DioExceptionType.receiveTimeout));
    expect(e.timedOut, isTrue);
    final other = ApiException.fromDio(DioException(requestOptions: RequestOptions(path: '/x'), type: DioExceptionType.cancel));
    expect(other.timedOut, isFalse);
  });
}
