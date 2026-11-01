import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_cn/core/illustrated.dart';

/// R3 matrix (200% text scale): the hero banner grows with the text instead of overflowing / clipping the copy.
void main() {
  for (final scale in [1.0, 2.0]) {
    testWidgets('hero banner at ${(scale * 100).round()}% text has no overflow', (t) async {
      t.view.devicePixelRatio = 1;
      t.view.physicalSize = const Size(768, 1024);
      addTearDown(t.view.reset);
      await t.pumpWidget(MaterialApp(
        builder: (context, c) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)), child: c!),
        home: const Scaffold(body: SingleChildScrollView(child: CfHeroBanner(asset: 'assets/none.webp', title: 'ContentFlow', subtitle: 'One topic in, a ready-to-post content pack out.'))),
      ));
      await t.pump();
      expect(t.takeException(), isNull);
      expect(find.text('ContentFlow'), findsOneWidget);
    });
  }
}
