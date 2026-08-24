import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:contentflow_global/main.dart';

void main() {
  testWidgets('global iOS app starts', (tester) async {
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
