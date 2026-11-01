import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:contentflow_global/main.dart';

void main() {
  Future<void> pumpAt(WidgetTester t, Size size) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    t.view.devicePixelRatio = 1;
    t.view.physicalSize = size;
    addTearDown(t.view.reset);
    await t.pumpWidget(ProviderScope(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      child: const MaterialApp(home: MainScreen()),
    ));
    await t.pump(const Duration(milliseconds: 300));
  }

  testWidgets('navigation rail from 600 dp (was 900), bottom bar below', (t) async {
    await pumpAt(t, const Size(768, 1024));
    expect(find.byType(NavigationRail), findsOneWidget);
    await pumpAt(t, const Size(600, 900));
    expect(find.byType(NavigationRail), findsOneWidget);
    await pumpAt(t, const Size(599, 900));
    expect(find.byType(NavigationRail), findsNothing);
  });
}
