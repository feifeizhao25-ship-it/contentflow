import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:contentflow_cn/main.dart';

void main() {
  testWidgets('国内版 iOS 应用可启动', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    await tester.pumpWidget(ProviderScope(
      overrides: [sharedPreferencesProvider.overrideWithValue(preferences)],
      child: const ContentFlowApp(),
    ));
    await tester.pump();
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
