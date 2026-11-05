// iPad / wide screens: the login card must stay a capped, centred column at 1024 and 1440.
import 'package:contentflow_cn/features/auth/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  for (final width in [1024.0, 1440.0]) {
    for (final b in [Brightness.light, Brightness.dark]) {
      testWidgets('login card capped and centred @${width.toInt()} ${b.name}', (tester) async {
        tester.view.physicalSize = Size(width, 1000);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(ProviderScope(
          child: MaterialApp(theme: ThemeData(brightness: b), home: const LoginScreen()),
        ));
        await tester.pump();
        final field = tester.getRect(find.byType(TextField).first);
        expect(field.width, lessThanOrEqualTo(480));
        expect(field.width, greaterThan(280));
        expect(field.center.dx, closeTo(width / 2, 1));
        final button = tester.getRect(find.byWidgetPredicate((w) => w is FilledButton || w is ElevatedButton).first);
        expect(button.width, lessThanOrEqualTo(480));
        expect(button.center.dx, closeTo(width / 2, 1));
        // the wide-screen card must follow the theme (no white card in dark mode)
        final cards = tester.widgetList<DecoratedBox>(find.ancestor(of: find.byType(TextField).first, matching: find.byType(DecoratedBox)))
            .map((d) => d.decoration).whereType<BoxDecoration>().where((d) => d.color != null && d.border != null);
        expect(cards, isNotEmpty, reason: 'wide screens should show the form inside a card');
        if (b == Brightness.dark) {
          for (final c in cards) {
            expect(c.color!.computeLuminance() < 0.5, isTrue, reason: 'card too light in dark mode: \${c.color}');
          }
        }
        expect(tester.takeException(), isNull);
      });
    }
  }
}
