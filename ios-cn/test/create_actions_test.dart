import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_cn/core/providers.dart';
import 'package:contentflow_cn/data/api_client.dart';
import 'package:contentflow_cn/data/api_exception.dart';
import 'package:contentflow_cn/data/models.dart';
import 'package:contentflow_cn/features/create/create_screen.dart';

class _FakeApi implements ApiClient {
  List<String>? platforms;
  ContentPack? saved;
  int saves = 0;
  Object? saveError;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<ContentPack> generateContentPack({
    required String topic,
    int titleCount = 5,
    List<String>? platforms,
  }) async {
    this.platforms = platforms;
    return ContentPack.fromJson({
      'titles': ['台灯的三种写法'],
      'script': 'Body',
      'platform_variants': [
        {
          'platform': 'xhs',
          'title': '',
          'body': 'AI 生成\n关于台灯的短段落\n#台灯 #AI生成内容',
          'hashtags': ['#台灯', '#AI生成内容'],
          'char_count': 62,
          'notes': ['分段短句、先说体验与结论'],
        },
        {
          'platform': 'weixin',
          'title': '',
          'body': 'AI 生成\n台灯口播脚本',
          'hashtags': ['#AI生成内容'],
          'char_count': 40,
          'notes': ['已压缩为口播长度，发布前请按视频节奏再核对。'],
        },
      ],
    });
  }

  @override
  Future<ContentPack> saveContentPack(ContentPack pack) async {
    saves++;
    if (saveError != null) throw saveError!;
    saved = pack;
    return pack;
  }
}

Future<_FakeApi> _open(WidgetTester t) async {
  t.view.physicalSize = const Size(900, 3600);
  t.view.devicePixelRatio = 1.0;
  addTearDown(t.view.reset);
  final api = _FakeApi();
  await t.pumpWidget(ProviderScope(
    overrides: [apiClientProvider.overrideWithValue(api)],
    child: const MaterialApp(home: CreateScreen()),
  ));
  await t.enterText(find.byType(TextField).first, 'desk lamp');
  return api;
}

void main() {
  testWidgets('the platform choice is sent, and at least one platform always stays selected', (t) async {
    final api = await _open(t);
    await t.tap(find.byKey(const ValueKey('platform-weixin')));
    await t.tap(find.byKey(const ValueKey('platform-douyin')));
    await t.tap(find.byKey(const ValueKey('platform-xhs')));
    await t.tap(find.byKey(const ValueKey('platform-wechat_mp')));
    await t.pump();
    await t.tap(find.text('生成内容包'));
    await t.pumpAndSettle();
    expect(api.platforms, ['weixin']);
  });

  testWidgets('Save to content pack saves the draft once, then shows Saved', (t) async {
    final api = await _open(t);
    await t.tap(find.text('生成内容包'));
    await t.pumpAndSettle();
    expect(api.platforms, ['xhs', 'douyin', 'wechat_mp']);
    await t.ensureVisible(find.text('保存到内容包'));
    await t.tap(find.text('保存到内容包'));
    await t.pumpAndSettle();
    expect(api.saves, 1);
    expect(api.saved?.titles, ['台灯的三种写法']);
    expect(find.text('已保存为云端草稿'), findsOneWidget);
    expect(find.text('已保存'), findsOneWidget);
    expect(find.text('保存到内容包'), findsNothing);
    });

  testWidgets('a failed save shows the reason and can be retried', (t) async {
    final api = await _open(t);
    api.saveError = ApiException('当前套餐存储已满。', statusCode: 429);
    await t.tap(find.text('生成内容包'));
    await t.pumpAndSettle();
    await t.ensureVisible(find.text('保存到内容包'));
    await t.tap(find.text('保存到内容包'));
    await t.pumpAndSettle();
    expect(find.text('当前套餐存储已满。'), findsOneWidget);
    expect(find.text('保存到内容包'), findsOneWidget);
    api.saveError = null;
    await t.pump(const Duration(seconds: 5));
    await t.tap(find.text('保存到内容包'));
    await t.pumpAndSettle();
    expect(api.saves, 2);
  });

  testWidgets('Platform adaptation shows the server rewrite for each platform, with notes', (t) async {
    await _open(t);
    await t.tap(find.text('生成内容包'));
    await t.pumpAndSettle();
    await t.ensureVisible(find.text('平台适配'));
    await t.tap(find.text('平台适配'));
    await t.pumpAndSettle();
    expect(find.text('各平台版本'), findsOneWidget);
    expect(find.byKey(const ValueKey('adapter-xhs')), findsOneWidget);
    expect(find.byKey(const ValueKey('adapter-weixin')), findsOneWidget);
    expect(find.textContaining('关于台灯的短段落'), findsOneWidget);
    expect(find.text('62 字'), findsOneWidget);
    expect(find.textContaining('已压缩为口播长度'), findsOneWidget);
    });

  test('older saved drafts (platform_payloads map) still read back', () {
    final pack = ContentPack.fromJson({
      'titles': ['t'],
      'platform_payloads': {
        'xhs': {'platform': 'xhs', 'adapted_content': 'old body'},
      },
    });
    expect(pack.platformPayloads!['xhs']!.adaptedContent, 'old body');
    expect(ContentPack.fromJson({'titles': ['t']}).platformPayloads, isNull);
  });
}
