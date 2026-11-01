// 复测 B28：被发布前合规检查拦下时，界面只说「请根据命中规则修改」，却没有告诉用户命中了哪条规则。
import 'package:contentflow_cn/core/providers.dart';
import 'package:contentflow_cn/data/api_client.dart';
import 'package:contentflow_cn/data/api_exception.dart';
import 'package:contentflow_cn/data/models.dart';
import 'package:contentflow_cn/data/token_storage.dart';
import 'package:contentflow_cn/features/create/create_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _blocked = '内容未通过发布前合规检查，请根据命中规则修改后重试。这不是法律意见。';

Map<String, dynamic> _envelope() => {
      'success': false,
      'error': {
        'code': 'CONTENT_COMPLIANCE_BLOCKED',
        'message': _blocked,
        'compliance': {
          'level': 'violation',
          'hits': [
            {'ruleId': 'CN-AD-ART9-3', 'severity': 'block', 'reason': '包含绝对化用语', 'matchedTerms': ['最好', '第一']},
            {'ruleId': 'CN-PLATFORM-OFFSITE', 'severity': 'review', 'reason': '疑似引导到站外联系或交易'},
          ],
        },
      },
    };

DioException _dioError() {
  final req = RequestOptions(path: '/ai/content-pack/generate');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(requestOptions: req, statusCode: 400, data: _envelope()),
  );
}

class _BlockedApi extends ApiClient {
  _BlockedApi() : super(TokenStorage(), baseUrl: 'https://test.invalid/api/v1');

  @override
  Future<ContentPack> generateContentPack({required String topic, int titleCount = 5, List<String>? platforms}) async {
    throw ApiException.fromDio(_dioError());
  }
}

void main() {
  test('the API error keeps the rules that were hit (id, blocking or not, reason, matched words)', () {
    final e = ApiException.fromDio(_dioError());
    expect(e.message, _blocked);
    expect(e.hits, hasLength(2));
    expect(e.hits[0].ruleId, 'CN-AD-ART9-3');
    expect(e.hits[0].blocking, isTrue);
    expect(e.hits[0].matchedTerms, ['最好', '第一']);
    expect(e.hits[1].blocking, isFalse);
  });

  test('errors without a compliance block carry no hits', () {
    final req = RequestOptions(path: '/x');
    final e = ApiException.fromDio(DioException(
      requestOptions: req,
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: req, statusCode: 400, data: {'success': false, 'error': {'message': '请输入主题'}}),
    ));
    expect(e.hits, isEmpty);
  });

  testWidgets('the error card names every rule that was hit, with the offending words', (tester) async {
    tester.view.physicalSize = const Size(800, 3000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(_BlockedApi())],
      child: const MaterialApp(home: Scaffold(body: CreateScreen())),
    ));
    await tester.enterText(find.byType(TextField).first, '全网最好的咖啡机');
    await tester.tap(find.text('生成内容包'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('命中的规则'), findsOneWidget);
    expect(find.byKey(const ValueKey('compliance-hit-CN-AD-ART9-3')), findsOneWidget);
    expect(find.byKey(const ValueKey('compliance-hit-CN-PLATFORM-OFFSITE')), findsOneWidget);
    expect(find.textContaining('包含绝对化用语'), findsOneWidget);
    expect(find.textContaining('「最好」、「第一」'), findsOneWidget);
    expect(find.textContaining('必须修改'), findsOneWidget);
    expect(find.textContaining('建议核对'), findsOneWidget);
  });
}
