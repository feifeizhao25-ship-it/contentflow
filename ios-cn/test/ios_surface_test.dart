import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_cn/features/auth/login_screen.dart';

void main() {
  test('iOS 桌面名称、语言和相册说明写在 Info.plist', () {
    final plist = File('ios/Runner/Info.plist').readAsStringSync();
    expect(plist, contains('<key>CFBundleDisplayName</key>'));
    expect(plist, contains('<string>分发侠</string>'));
    expect(plist, contains('<string>zh-Hans</string>'));
    expect(plist, contains('NSPhotoLibraryUsageDescription'));
    expect(plist, contains('NSCameraUsageDescription'));
    expect(plist, isNot(contains('Contentflow Cn')));
  });

  test('页面使用 SafeArea，底部导航不会顶进横条', () {
    final main = File('lib/main.dart').readAsStringSync();
    expect(main, contains('SafeArea('));
    expect(main, contains("title: '分发侠'"));
    for (final screen in [
      'lib/features/today/today_screen.dart',
      'lib/features/auth/login_screen.dart',
      'lib/features/account/account_screen.dart',
    ]) {
      expect(File(screen).readAsStringSync(), contains('SafeArea('), screen);
    }
  });

  testWidgets('登录页在 iPhone 15 Pro 安全区内仍显示中文产品名', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    addTearDown(() => debugDefaultTargetPlatformOverride = null);
    tester.view.devicePixelRatio = 3;
    tester.view.physicalSize = const Size(393 * 3, 852 * 3);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(const MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(padding: EdgeInsets.only(top: 59, bottom: 34), size: Size(393, 852)),
        child: LoginScreen(),
      ),
    ));
    expect(find.text('分发侠'), findsOneWidget);
    expect(find.text('欢迎登录'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
