// 复测 B14：登录页直接摆着「工作室标识（可选）」，普通创作者看不懂这是什么。
import 'package:contentflow_cn/features/auth/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _pump(WidgetTester tester) async {
  tester.view.physicalSize = const Size(800, 1600);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(const ProviderScope(child: MaterialApp(home: LoginScreen())));
  await tester.pump();
}

void main() {
  testWidgets('a normal creator sees only email and password; the jargon label is gone', (tester) async {
    await _pump(tester);
    expect(find.text('邮箱'), findsOneWidget);
    expect(find.text('密码'), findsOneWidget);
    expect(find.textContaining('工作室标识'), findsNothing);
    expect(find.byKey(const ValueKey('team-code-field')), findsNothing);
    expect(find.byType(TextField), findsNWidgets(2));
  });

  testWidgets('people who joined a team can open a team-code field that explains itself', (tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const ValueKey('show-team-code')));
    await tester.pump();
    expect(find.byKey(const ValueKey('team-code-field')), findsOneWidget);
    expect(find.text('团队代码'), findsOneWidget);
    expect(find.textContaining('个人使用不需要填写'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(3));
    await tester.enterText(find.byKey(const ValueKey('team-code-field')), ' studio-a ');
    expect(find.text(' studio-a '), findsOneWidget);
  });
}
