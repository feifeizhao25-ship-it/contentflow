import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_global/core/providers.dart';
import 'package:contentflow_global/data/api_client.dart';
import 'package:contentflow_global/data/api_exception.dart';
import 'package:contentflow_global/data/models.dart';
import 'package:contentflow_global/features/create/create_screen.dart';

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
    String? targetMarket,
    String? material,
    List<String>? platforms,
  }) async {
    this.platforms = platforms;
    return ContentPack.fromJson({
      'titles': ['Desk lamp, three ways'],
      'script': 'Body',
      'platform_variants': [
        {
          'platform': 'instagram',
          'title': '',
          'body': 'AI-generated\nShort paragraphs about the lamp\n#desklamp #AIGenerated',
          'hashtags': ['#desklamp', '#AIGenerated'],
          'char_count': 62,
          'notes': ['Short paragraphs; lead with the takeaway'],
        },
        {
          'platform': 'tiktok',
          'title': '',
          'body': 'AI-generated\nSpoken script for the lamp',
          'hashtags': ['#AIGenerated'],
          'char_count': 40,
          'notes': ['Compressed to spoken length; check it against the pacing of your video before publishing.'],
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

bool _cjk(WidgetTester t) => RegExp(r'[\u3400-\u9fff]').hasMatch(
  t.widgetList<Text>(find.byType(Text)).map((x) => x.data ?? '').join(' '),
);

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
    await t.tap(find.byKey(const ValueKey('platform-linkedin')));
    await t.tap(find.byKey(const ValueKey('platform-x')));
    await t.tap(find.byKey(const ValueKey('platform-instagram')));
    await t.tap(find.byKey(const ValueKey('platform-tiktok')));
    await t.pump();
    await t.tap(find.text('Generate content pack'));
    await t.pumpAndSettle();
    expect(api.platforms, ['linkedin']);
  });

  testWidgets('Save to content pack saves the draft once, then shows Saved', (t) async {
    final api = await _open(t);
    await t.tap(find.text('Generate content pack'));
    await t.pumpAndSettle();
    expect(api.platforms, ['instagram', 'tiktok', 'x']);
    await t.ensureVisible(find.text('Save to content pack'));
    await t.tap(find.text('Save to content pack'));
    await t.pumpAndSettle();
    expect(api.saves, 1);
    expect(api.saved?.titles, ['Desk lamp, three ways']);
    expect(find.text('Saved as a cloud draft'), findsOneWidget);
    expect(find.text('Saved'), findsOneWidget);
    expect(find.text('Save to content pack'), findsNothing);
    expect(_cjk(t), isFalse);
  });

  testWidgets('a failed save shows the reason and can be retried', (t) async {
    final api = await _open(t);
    api.saveError = ApiException('Your plan has no storage left.', statusCode: 429);
    await t.tap(find.text('Generate content pack'));
    await t.pumpAndSettle();
    await t.ensureVisible(find.text('Save to content pack'));
    await t.tap(find.text('Save to content pack'));
    await t.pumpAndSettle();
    expect(find.text('Your plan has no storage left.'), findsOneWidget);
    expect(find.text('Save to content pack'), findsOneWidget);
    api.saveError = null;
    await t.pump(const Duration(seconds: 5));
    await t.tap(find.text('Save to content pack'));
    await t.pumpAndSettle();
    expect(api.saves, 2);
  });

  testWidgets('Platform adaptation shows the server rewrite for each platform, with notes', (t) async {
    await _open(t);
    await t.tap(find.text('Generate content pack'));
    await t.pumpAndSettle();
    await t.ensureVisible(find.text('Platform adaptation'));
    await t.tap(find.text('Platform adaptation'));
    await t.pumpAndSettle();
    expect(find.text('Platform versions'), findsOneWidget);
    expect(find.byKey(const ValueKey('adapter-instagram')), findsOneWidget);
    expect(find.byKey(const ValueKey('adapter-tiktok')), findsOneWidget);
    expect(find.textContaining('Short paragraphs about the lamp'), findsOneWidget);
    expect(find.text('62 characters'), findsOneWidget);
    expect(find.textContaining('Compressed to spoken length'), findsOneWidget);
    expect(_cjk(t), isFalse);
  });

  test('older saved drafts (platform_payloads map) still read back', () {
    final pack = ContentPack.fromJson({
      'titles': ['t'],
      'platform_payloads': {
        'instagram': {'platform': 'instagram', 'adapted_content': 'old body'},
      },
    });
    expect(pack.platformPayloads!['instagram']!.adaptedContent, 'old body');
    expect(ContentPack.fromJson({'titles': ['t']}).platformPayloads, isNull);
  });
}
