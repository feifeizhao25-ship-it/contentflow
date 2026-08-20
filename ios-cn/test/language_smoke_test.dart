import 'package:contentflow_cn/features/auth/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_cn/config/cn_config.dart';

void main() {
  test('production API URL is explicit and HTTPS', () {
    expect(() => AppConfig.validateApiBaseUrl(''), throwsStateError);
    expect(
      () => AppConfig.validateApiBaseUrl('http://example.com/api/v1'),
      throwsStateError,
    );
    expect(
      () => AppConfig.validateApiBaseUrl('https://api.example.com/v1'),
      throwsStateError,
    );
    expect(
      AppConfig.validateApiBaseUrl('https://api.example.com/api/v1/'),
      'https://api.example.com/api/v1',
    );
  });
  testWidgets('国内版 iOS 登录页保持中文', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));

    expect(find.text('欢迎登录'), findsOneWidget);
    expect(find.text('登录'), findsOneWidget);
    expect(find.text('Welcome back'), findsNothing);
  });
}
