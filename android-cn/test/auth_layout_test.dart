import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:contentflow_cn/core/providers.dart';
import 'package:contentflow_cn/data/token_storage.dart';
import 'package:contentflow_cn/main.dart';

class _ScriptedStore implements SecretStore {
  _ScriptedStore({this.readError, this.deleteError});

  final Object? readError;
  final Object? deleteError;
  var deleted = false;

  @override
  Future<void> delete({required String key}) async {
    deleted = true;
    if (deleteError != null) throw deleteError!;
  }

  @override
  Future<String?> read({required String key}) async {
    if (readError != null) throw readError!;
    return null;
  }

  @override
  Future<void> write({required String key, required String value}) async {}
}

Future<void> _pump(
  WidgetTester tester, {
  required Size size,
  Brightness brightness = Brightness.light,
  List<Override> extra = const [],
}) async {
  SharedPreferences.setMockInitialValues({});
  final preferences = await SharedPreferences.getInstance();
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  tester.platformDispatcher.platformBrightnessTestValue = brightness;
  await tester.pumpWidget(ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(preferences),
      if (extra.isEmpty) tokenStorageProvider.overrideWith((ref) => TokenStorage(store: _ScriptedStore())),
      ...extra,
    ],
    child: const ContentFlowApp(),
  ));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

Future<void> _shot(WidgetTester tester, String name) async {
  await tester.runAsync(() async {
    final boundary = tester.renderObject<RenderRepaintBoundary>(find.byType(RepaintBoundary).first);
    final image = await boundary.toImage(pixelRatio: 1);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    // 截图只是留档：目录不可写（比如本机没有 /opt/cursor）时跳过，不让测试失败。
    // 可用环境变量 SCREENSHOT_DIR 指定输出目录。
    final dir = Directory(Platform.environment['SCREENSHOT_DIR'] ?? '/opt/cursor/artifacts/screenshots/after');
    try {
      dir.createSync(recursive: true);
      File('${dir.path}/$name').writeAsBytesSync(bytes!.buffer.asUint8List());
    } on FileSystemException {
      return;
    }
  });
}

void main() {
  tearDown(() {});

  test('钥匙串读失败记日志后当作未登录，并尝试清掉坏数据', () async {
    final store = _ScriptedStore(readError: StateError('errSecMissingEntitlement -34018'), deleteError: StateError('delete'));
    final storage = TokenStorage(store: store);
    expect(await storage.readToken(), isNull);
    expect(store.deleted, isTrue);
  });

  testWidgets('iPhone 16 Pro 读不到登录状态时进入登录页', (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    final store = _ScriptedStore(readError: StateError('SecItemCopyMatching -34018'));
    await _pump(
      tester,
      size: const Size(402, 874),
      extra: [tokenStorageProvider.overrideWith((ref) => TokenStorage(store: store))],
    );
    expect(find.text('登录状态读取失败，请重新打开应用'), findsNothing);
    expect(find.text('欢迎登录'), findsOneWidget);
    expect(store.deleted, isTrue);
    await _shot(tester, 'android-iphone-16-pro-login-light.png');
  });

  testWidgets('iPhone SE 第三代浅色登录页不溢出', (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    await _pump(tester, size: const Size(375, 667));
    expect(find.text('欢迎登录'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await _shot(tester, 'android-iphone-se-login-light.png');
  });

  testWidgets('iPad 意外失败时给出重试和重新登录，而不是一行小字', (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(1032, 1376);
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.light;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        authStateProvider.overrideWith((ref) async => throw StateError('boom')),
      ],
      child: const ContentFlowApp(),
    ));
    await tester.pump();
    expect(find.text('暂时无法确认登录状态'), findsOneWidget);
    expect(find.text('重试'), findsOneWidget);
    expect(find.text('重新登录'), findsOneWidget);
    expect(find.text('登录状态读取失败，请重新打开应用'), findsNothing);
    final title = tester.getSize(find.text('暂时无法确认登录状态'));
    expect(title.width, lessThan(520));
    expect(title.width, greaterThan(200));
    await _shot(tester, 'android-ipad-pro-13-auth-failure-light.png');

    await tester.tap(find.text('重新登录'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text('欢迎登录'), findsOneWidget);
  });

  testWidgets('深色模式跟随系统，登录页背景不再是浅色', (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    await _pump(tester, size: const Size(402, 874), brightness: Brightness.dark);
    expect(find.text('欢迎登录'), findsOneWidget);
    final context = tester.element(find.text('欢迎登录'));
    final background = Theme.of(context).scaffoldBackgroundColor;
    expect(ThemeData.estimateBrightnessForColor(background), Brightness.dark);
    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.themeMode, ThemeMode.system);
    expect(app.darkTheme, isNotNull);
    await _shot(tester, 'android-iphone-16-pro-login-dark.png');
  });

  testWidgets('iPad 深色登录页内容收在中间一列', (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    await _pump(tester, size: const Size(1032, 1376), brightness: Brightness.dark);
    expect(find.text('欢迎登录'), findsOneWidget);
    final box = tester.getRect(find.text('欢迎登录'));
    expect(box.center.dx, closeTo(1032 / 2, 40));
    expect(box.width, lessThan(480));
    await _shot(tester, 'android-ipad-pro-13-login-dark.png');
  });
}
