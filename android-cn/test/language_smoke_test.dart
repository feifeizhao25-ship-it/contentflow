import 'package:contentflow_cn/features/auth/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('国内版登录页保持中文', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));

    expect(find.text('欢迎登录'), findsOneWidget);
    expect(find.text('登录'), findsOneWidget);
    expect(find.text('Welcome back'), findsNothing);
  });
}
