import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_global/core/providers.dart';
import 'package:contentflow_global/data/models.dart';
import 'package:contentflow_global/features/assets/drafts_view.dart';

Widget _host(List<Override> overrides) => ProviderScope(
      overrides: overrides,
      child: const MaterialApp(home: Scaffold(body: DraftsView())),
    );

ContentDraft _d(String title, String body) => ContentDraft(
      id: title, title: title, body: body, source: 'ai', status: 'draft', createdAt: DateTime(2026, 10, 31, 8, 50),
    );

void main() {
  test('ContentDraft reads the /contents record shape', () {
    final d = ContentDraft.fromJson({'id': 'a', 'title': 'T', 'body': 'B', 'source': 'ai', 'status': 'draft', 'created_at': '2026-10-31T08:50:37.802Z'});
    expect(d.title, 'T');
    expect(d.createdAt.year, 2026);
    expect(ContentDraft.fromJson({}).title, '');
  });

  testWidgets('empty state explains how drafts get here', (tester) async {
    await tester.pumpWidget(_host([contentDraftsProvider.overrideWith((ref) async => <ContentDraft>[])]));
    await tester.pumpAndSettle();
    expect(find.text('No saved drafts yet'), findsOneWidget);
    expect(find.textContaining('Save to content pack'), findsOneWidget);
  });

  testWidgets('lists saved drafts with title, plain-text snippet and source; tap opens the full text', (tester) async {
    await tester.pumpWidget(_host([
      contentDraftsProvider.overrideWith((ref) async => [_d('First pack', '### **Heading**\n\nSome body text here'), _d('Second pack', 'x')]),
    ]));
    await tester.pumpAndSettle();
    expect(find.text('First pack'), findsOneWidget);
    expect(find.text('Second pack'), findsOneWidget);
    expect(find.text('Heading Some body text here'), findsOneWidget);
    expect(find.text('AI generated'), findsNWidgets(2));
    await tester.tap(find.text('First pack'));
    await tester.pumpAndSettle();
    expect(find.byType(SelectableText), findsOneWidget);
  });

  testWidgets('a load failure shows a retry instead of a blank tab', (tester) async {
    await tester.pumpWidget(_host([contentDraftsProvider.overrideWith((ref) async => throw Exception('boom'))]));
    await tester.pumpAndSettle();
    expect(find.text('Could not load your drafts.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    expect(find.textContaining('boom'), findsNothing);
  });
}
