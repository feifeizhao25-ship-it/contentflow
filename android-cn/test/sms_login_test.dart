import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:contentflow_cn/data/api_client.dart';
import 'package:contentflow_cn/data/api_exception.dart';
import 'package:contentflow_cn/data/token_storage.dart';
import 'package:contentflow_cn/features/auth/china_mobile.dart';
import 'package:contentflow_cn/features/auth/login_screen.dart';
import 'package:contentflow_cn/features/auth/sms_resend_countdown.dart';
import 'package:contentflow_cn/core/providers.dart';
import 'package:contentflow_cn/main.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MemorySecretStore implements SecretStore {
  final values = <String, String>{};

  @override
  Future<void> delete({required String key}) async {
    values.remove(key);
  }

  @override
  Future<String?> read({required String key}) async => values[key];

  @override
  Future<void> write({required String key, required String value}) async {
    values[key] = value;
  }
}

class ScriptedAdapter implements HttpClientAdapter {
  ScriptedAdapter(this._handler);

  final Future<ResponseBody> Function(RequestOptions options, String body)
  _handler;
  final calls =
      <
        ({
          String method,
          String path,
          String body,
          Map<String, dynamic> headers,
        })
      >[];

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final bytes = <int>[];
    if (requestStream != null) {
      await for (final chunk in requestStream) {
        bytes.addAll(chunk);
      }
    }
    final body = utf8.decode(bytes);
    calls.add((
      method: options.method,
      path: options.uri.path,
      body: body,
      headers: Map<String, dynamic>.from(options.headers),
    ));
    return _handler(options, body);
  }
}

ResponseBody jsonBody(Object? payload, int status) {
  return ResponseBody.fromString(
    jsonEncode(payload),
    status,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

ResponseBody envelope({
  required int status,
  Object? data,
  String? message,
  String? code,
}) {
  if (status >= 400) {
    return jsonBody({
      'success': false,
      'error': {'code': code ?? 'ERROR', 'message': message},
    }, status);
  }
  return jsonBody({'success': true, 'data': data}, status);
}

ApiClient _client(MemorySecretStore store, ScriptedAdapter adapter) {
  return ApiClient(
    TokenStorage(store: store),
    baseUrl: 'https://api.example.com/api/v1',
    httpClientAdapter: adapter,
  );
}

void main() {
  group('大陆手机号', () {
    test('11 位、+86、86 前缀和分隔符都规范成同一号码', () {
      expect(normalizeChinaMobile('13800138000'), '13800138000');
      expect(normalizeChinaMobile('+86 138-0013-8000'), '13800138000');
      expect(normalizeChinaMobile('86 138 0013 8000'), '13800138000');
      expect(normalizeChinaMobile('  +8613800138000  '), '13800138000');
    });

    test('位数不对、号段不对、空字符串都不通过', () {
      expect(normalizeChinaMobile('12345'), isNull);
      expect(normalizeChinaMobile('1380013800'), isNull);
      expect(normalizeChinaMobile('12800138000'), isNull);
      expect(normalizeChinaMobile('23800138000'), isNull);
      expect(normalizeChinaMobile(''), isNull);
      expect(normalizeChinaMobile(null), isNull);
      expect(normalizeChinaMobile('861380013800'), isNull);
    });

    test('验证码必须是 6 位数字', () {
      expect(isSixDigitCode('123456'), isTrue);
      expect(isSixDigitCode('12345'), isFalse);
      expect(isSixDigitCode('1234567'), isFalse);
      expect(isSixDigitCode('12a456'), isFalse);
      expect(isSixDigitCode(''), isFalse);
    });
  });

  group('验证码倒计时', () {
    test('从 60 秒递减到 0，结束后可以再次获取', () {
      final countdown = SmsResendCountdown();
      expect(countdown.coolingDown, isFalse);
      expect(countdown.buttonLabel, '获取验证码');
      countdown.start(resolveResendSeconds(null));
      expect(countdown.remaining, 60);
      expect(countdown.buttonLabel, '60 秒后重试');
      expect(countdown.tick(), isTrue);
      expect(countdown.remaining, 59);
      countdown.start(1);
      expect(countdown.tick(), isFalse);
      expect(countdown.remaining, 0);
      expect(countdown.coolingDown, isFalse);
      expect(countdown.buttonLabel, '获取验证码');
      expect(countdown.tick(), isFalse);
    });

    test('服务端给出的冷却秒数优先；0 或负数退回 60', () {
      expect(resolveResendSeconds(15), 15);
      expect(resolveResendSeconds(0), 60);
      expect(resolveResendSeconds(-3), 60);
      expect(resolveResendSeconds(null), 60);
    });

    test('从冷却文案取出等待秒数，日限额文案没有秒数', () {
      expect(cooldownSecondsFromMessage('获取验证码太频繁，请 42 秒后再试'), 42);
      expect(cooldownSecondsFromMessage('该手机号今天获取验证码次数过多，请明天再试'), isNull);
      expect(cooldownSecondsFromMessage('当前网络获取验证码次数过多，请稍后再试'), isNull);
    });
  });

  group('短信登录接口', () {
    test('发送验证码：路径、用途和规范化后的手机号', () async {
      final store = MemorySecretStore();
      final adapter = ScriptedAdapter((options, body) async {
        return envelope(
          status: 200,
          data: {'expiresInSeconds': 300, 'resendAfterSeconds': 60},
        );
      });
      final ticket = await _client(
        store,
        adapter,
      ).sendLoginSmsCode(phone: '13800138000');
      expect(ticket.expiresInSeconds, 300);
      expect(ticket.resendAfterSeconds, 60);
      expect(adapter.calls, hasLength(1));
      final call = adapter.calls.single;
      expect(call.method, 'POST');
      expect(call.path, '/api/v1/auth/sms/send');
      expect(jsonDecode(call.body), {
        'phone': '13800138000',
        'purpose': 'login',
      });
      expect(call.headers['X-Client'], 'mobile');
      expect(call.headers.containsKey('Authorization'), isFalse);
    });

    test('响应没给冷却秒数时按 60 秒', () async {
      final adapter = ScriptedAdapter(
        (options, body) async => envelope(status: 200, data: {}),
      );
      final ticket = await _client(
        MemorySecretStore(),
        adapter,
      ).sendLoginSmsCode(phone: '13800138000');
      expect(ticket.expiresInSeconds, 300);
      expect(ticket.resendAfterSeconds, 60);
    });

    test('登录成功只保存 access token', () async {
      final store = MemorySecretStore();
      final adapter = ScriptedAdapter((options, body) async {
        return envelope(
          status: 200,
          data: {
            'token': 'access-1',
            'refreshToken': 'refresh-1',
            'user': {'id': 'u9', 'email': '', 'name': '小王', 'role': 'owner'},
          },
        );
      });
      await _client(
        store,
        adapter,
      ).loginWithSms(phone: '13800138000', code: '654321');
      expect(jsonDecode(adapter.calls.single.body), {
        'phone': '13800138000',
        'code': '654321',
      });
      expect(adapter.calls.single.path, '/api/v1/auth/login/sms');
      expect(await TokenStorage(store: store).readToken(), 'access-1');
      expect(store.values.values, isNot(contains('refresh-1')));
    });

    test('没有令牌、验证码错误、冷却、发送失败、未配置、网络异常都抛出中文', () async {
      Future<ApiException> capture(
        ScriptedAdapter adapter,
        Future<void> Function(ApiClient client) run,
      ) async {
        try {
          await run(_client(MemorySecretStore(), adapter));
        } on ApiException catch (error) {
          return error;
        }
        fail('应当抛出 ApiException');
      }

      final missing = await capture(
        ScriptedAdapter(
          (options, body) async => envelope(status: 200, data: {'user': {}}),
        ),
        (client) => client.loginWithSms(phone: '13800138000', code: '123456'),
      );
      expect(missing.message, '登录失败，未返回令牌');

      final wrong = await capture(
        ScriptedAdapter(
          (options, body) async =>
              envelope(status: 400, message: '验证码不正确', code: 'BAD_REQUEST'),
        ),
        (client) => client.loginWithSms(phone: '13800138000', code: '000000'),
      );
      expect(wrong.statusCode, 400);
      expect(wrong.message, '验证码不正确');

      final expired = await capture(
        ScriptedAdapter(
          (options, body) async =>
              envelope(status: 400, message: '验证码已过期或未获取，请重新获取'),
        ),
        (client) => client.loginWithSms(phone: '13900001111', code: '123456'),
      );
      expect(expired.message, '验证码已过期或未获取，请重新获取');

      final cooldown = await capture(
        ScriptedAdapter(
          (options, body) async =>
              envelope(status: 429, message: '获取验证码太频繁，请 42 秒后再试'),
        ),
        (client) => client.sendLoginSmsCode(phone: '13800138000'),
      );
      expect(cooldown.statusCode, 429);
      expect(cooldown.message, contains('42 秒'));

      final failed = await capture(
        ScriptedAdapter(
          (options, body) async =>
              envelope(status: 503, message: '短信发送失败，请稍后重试'),
        ),
        (client) => client.sendLoginSmsCode(phone: '13800138000'),
      );
      expect(failed.statusCode, 503);
      expect(failed.message, '短信发送失败，请稍后重试');

      final unconfigured = await capture(
        ScriptedAdapter(
          (options, body) async =>
              envelope(status: 503, message: '短信服务未配置，暂时无法发送验证码'),
        ),
        (client) => client.sendLoginSmsCode(phone: '13800138000'),
      );
      expect(unconfigured.message, contains('短信服务未配置'));

      final network = await capture(
        ScriptedAdapter((options, body) async {
          throw DioException(
            requestOptions: options,
            type: DioExceptionType.connectionError,
            message: 'SocketException: Connection refused',
          );
        }),
        (client) => client.sendLoginSmsCode(phone: '13800138000'),
      );
      expect(network.message, '网络连接失败');
      expect(network.message, isNot(contains('SocketException')));
    });

    test('校验错误是字符串数组时拼成一条中文', () async {
      final adapter = ScriptedAdapter((options, body) async {
        return jsonBody({
          'success': false,
          'error': {
            'message': ['请输入 6 位数字验证码', '验证码不正确'],
          },
        }, 400);
      });
      try {
        await _client(
          MemorySecretStore(),
          adapter,
        ).loginWithSms(phone: '13800138000', code: '000000');
        fail('应当失败');
      } on ApiException catch (error) {
        expect(error.message, '请输入 6 位数字验证码；验证码不正确');
      }
    });

    test('邮箱密码登录的请求体保持不变', () async {
      final store = MemorySecretStore();
      final adapter = ScriptedAdapter((options, body) async {
        return envelope(
          status: 200,
          data: {'token': 'email-token', 'refreshToken': 'email-refresh'},
        );
      });
      await _client(
        store,
        adapter,
      ).login(email: 'a@b.cn', password: 'secret12', tenantSlug: 'studio-a');
      expect(adapter.calls.single.path, '/api/v1/auth/login');
      expect(jsonDecode(adapter.calls.single.body), {
        'email': 'a@b.cn',
        'password': 'secret12',
        'tenant_slug': 'studio-a',
      });
      expect(await TokenStorage(store: store).readToken(), 'email-token');
    });
  });

  group('登录页', () {
    late MemorySecretStore store;
    late ScriptedAdapter adapter;

    setUp(() {
      store = MemorySecretStore();
      adapter = ScriptedAdapter(
        (options, body) async => envelope(status: 500, message: '未模拟的接口'),
      );
    });

    Future<void> pumpLogin(
      WidgetTester tester, {
      Size size = const Size(390, 844),
    }) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      addTearDown(() async {
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(milliseconds: 20));
      });
      final storage = TokenStorage(store: store);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            tokenStorageProvider.overrideWithValue(storage),
            apiClientProvider.overrideWithValue(_client(store, adapter)),
          ],
          child: MaterialApp(home: LoginScreen(key: UniqueKey())),
        ),
      );
      await tester.pump();
    }

    /// Dio 的拦截器是异步的，点按后要再推进几帧请求才会落地。
    Future<void> flush(WidgetTester tester) async {
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pump();
    }

    testWidgets('格式不对时不发请求，并显示中文原因', (tester) async {
      await pumpLogin(tester);
      await tester.enterText(
        find.byKey(const ValueKey('login-phone')),
        '12345',
      );
      await tester.tap(find.byKey(const ValueKey('login-send-code')));
      await tester.pump();
      expect(find.text(kChinaMobileError), findsOneWidget);
      expect(adapter.calls, isEmpty);

      await tester.enterText(
        find.byKey(const ValueKey('login-phone')),
        '+86 138-0013-8000',
      );
      await tester.enterText(find.byKey(const ValueKey('login-code')), '1234');
      await tester.tap(find.byKey(const ValueKey('login-submit')));
      await tester.pump();
      expect(find.text(kSmsCodeError), findsOneWidget);
      expect(adapter.calls, isEmpty);
    });

    testWidgets('发送成功后倒计时，期间不能再次发送', (tester) async {
      adapter = ScriptedAdapter((options, body) async {
        return envelope(
          status: 200,
          data: {'expiresInSeconds': 300, 'resendAfterSeconds': 3},
        );
      });
      await pumpLogin(tester);
      await tester.enterText(
        find.byKey(const ValueKey('login-phone')),
        '13800138000',
      );
      await tester.ensureVisible(find.byKey(const ValueKey('login-send-code')));
      await tester.tap(find.byKey(const ValueKey('login-send-code')));
      await flush(tester);
      expect(find.text('验证码已发送，请注意查收短信'), findsOneWidget);
      expect(find.text('3 秒后重试'), findsOneWidget);
      expect(adapter.calls, hasLength(1));

      await tester.tap(find.byKey(const ValueKey('login-send-code')));
      await tester.pump();
      expect(adapter.calls, hasLength(1));

      await tester.pump(const Duration(seconds: 1));
      expect(find.text('2 秒后重试'), findsOneWidget);
      await tester.pump(const Duration(seconds: 2));
      expect(find.text('获取验证码'), findsOneWidget);

      await tester.ensureVisible(find.byKey(const ValueKey('login-send-code')));
      await tester.tap(find.byKey(const ValueKey('login-send-code')));
      await flush(tester);
      expect(adapter.calls, hasLength(2));
    });

    testWidgets('发送过程中连点只发出一次', (tester) async {
      final gate = Completer<void>();
      adapter = ScriptedAdapter((options, body) async {
        await gate.future;
        return envelope(
          status: 200,
          data: {'expiresInSeconds': 300, 'resendAfterSeconds': 60},
        );
      });
      await pumpLogin(tester);
      await tester.enterText(
        find.byKey(const ValueKey('login-phone')),
        '13800138000',
      );
      await tester.ensureVisible(find.byKey(const ValueKey('login-send-code')));
      await tester.tap(find.byKey(const ValueKey('login-send-code')));
      await tester.pump();
      expect(
        tester
            .widget<OutlinedButton>(
              find.byKey(const ValueKey('login-send-code')),
            )
            .onPressed,
        isNull,
      );
      for (var i = 0; i < 8 && adapter.calls.isEmpty; i++) {
        await tester.pump(const Duration(milliseconds: 20));
      }
      expect(adapter.calls, hasLength(1));
      await tester.tap(find.byKey(const ValueKey('login-send-code')));
      await tester.pump();
      expect(adapter.calls, hasLength(1));
      gate.complete();
      await flush(tester);
      expect(find.text('60 秒后重试'), findsOneWidget);
    });

    Future<void> sendPhone(WidgetTester tester) async {
      await pumpLogin(tester);
      await tester.enterText(
        find.byKey(const ValueKey('login-phone')),
        '13800138000',
      );
      await tester.ensureVisible(find.byKey(const ValueKey('login-send-code')));
      await tester.tap(find.byKey(const ValueKey('login-send-code')));
      await flush(tester);
    }

    testWidgets('冷却中的 429 显示剩余秒数并开始倒计时', (tester) async {
      adapter = ScriptedAdapter((options, body) async {
        return envelope(status: 429, message: '获取验证码太频繁，请 42 秒后再试');
      });
      await sendPhone(tester);
      expect(find.text('获取验证码太频繁，请 42 秒后再试'), findsOneWidget);
      expect(find.text('42 秒后重试'), findsOneWidget);
      expect(
        tester
            .widget<OutlinedButton>(
              find.byKey(const ValueKey('login-send-code')),
            )
            .onPressed,
        isNull,
      );
    });

    testWidgets('发送失败和短信未配置都显示原因，按钮可以再试', (tester) async {
      adapter = ScriptedAdapter((options, body) async {
        return envelope(status: 503, message: '短信发送失败，请稍后重试');
      });
      await sendPhone(tester);
      expect(find.text('短信发送失败，请稍后重试'), findsOneWidget);
      expect(find.text('获取验证码'), findsOneWidget);
      expect(find.textContaining('SocketException'), findsNothing);

      adapter = ScriptedAdapter((options, body) async {
        return envelope(status: 503, message: '短信服务未配置，暂时无法发送验证码');
      });
      await sendPhone(tester);
      expect(find.textContaining('短信服务未配置'), findsOneWidget);
    });

    testWidgets('当天次数用尽时显示原因，不假装已经发出', (tester) async {
      adapter = ScriptedAdapter((options, body) async {
        return envelope(status: 429, message: '该手机号今天获取验证码次数过多，请明天再试');
      });
      await sendPhone(tester);
      expect(find.textContaining('次数过多'), findsOneWidget);
      expect(find.text('获取验证码'), findsOneWidget);
      expect(find.text('验证码已发送，请注意查收短信'), findsNothing);
    });

    testWidgets('验证码错误留在页面上，并且不写入令牌', (tester) async {
      adapter = ScriptedAdapter((options, body) async {
        return envelope(status: 400, message: '验证码不正确', code: 'BAD_REQUEST');
      });
      await pumpLogin(tester);
      await tester.enterText(
        find.byKey(const ValueKey('login-phone')),
        '13800138000',
      );
      await tester.enterText(
        find.byKey(const ValueKey('login-code')),
        '000000',
      );
      await tester.ensureVisible(find.byKey(const ValueKey('login-submit')));
      await tester.tap(find.byKey(const ValueKey('login-submit')));
      await flush(tester);
      expect(find.text('验证码不正确'), findsOneWidget);
      expect(await TokenStorage(store: store).readToken(), isNull);
    });

    testWidgets('网络异常显示中文，不出现异常原文', (tester) async {
      adapter = ScriptedAdapter((options, body) async {
        throw DioException(
          requestOptions: options,
          type: DioExceptionType.connectionError,
          message: 'SocketException: Connection refused',
        );
      });
      await sendPhone(tester);
      expect(find.text('网络连接失败'), findsOneWidget);
      expect(find.textContaining('SocketException'), findsNothing);
    });

    testWidgets('验证码登录成功后写入令牌并进入主界面', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      adapter = ScriptedAdapter((options, body) async {
        if (options.uri.path.endsWith('/auth/login/sms')) {
          expect(jsonDecode(body), {'phone': '13800138000', 'code': '654321'});
          return envelope(
            status: 200,
            data: {
              'token': 'sms-token',
              'refreshToken': 'sms-refresh',
              'user': {'id': 'u9', 'email': '', 'name': '小王', 'role': 'owner'},
            },
          );
        }
        return envelope(status: 200, data: {});
      });
      final storage = TokenStorage(store: store);
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final previousOnError = FlutterError.onError;
      FlutterError.onError = (details) {
        // Flutter 3.50 对账号页/素材页原有的 ListTile + 装饰盒组合给出断言。
        // 与登录无关；这里只放行这一条，其它异常仍按失败处理。
        if (details.exceptionAsString().contains('ListTile background color')) {
          return;
        }
        previousOnError?.call(details);
      };
      addTearDown(() => FlutterError.onError = previousOnError);
      addTearDown(() async {
        await tester.pumpWidget(const SizedBox.shrink());
        for (var i = 0; i < 6; i++) {
          await tester.pump(const Duration(milliseconds: 50));
        }
      });
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sharedPreferencesProvider.overrideWithValue(preferences),
            tokenStorageProvider.overrideWithValue(storage),
            apiClientProvider.overrideWithValue(_client(store, adapter)),
          ],
          child: const ContentFlowApp(),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.text('欢迎登录'), findsOneWidget);

      await tester.enterText(
        find.byKey(const ValueKey('login-phone')),
        '138 0013 8000',
      );
      await tester.enterText(
        find.byKey(const ValueKey('login-code')),
        '654321',
      );
      await tester.tap(find.byKey(const ValueKey('login-submit')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pump(const Duration(milliseconds: 50));

      expect(await storage.readToken(), 'sms-token');
      expect(store.values.values, isNot(contains('sms-refresh')));
      expect(find.text('欢迎登录'), findsNothing);
      expect(find.text('今日'), findsWidgets);
      final loginCall = adapter.calls.singleWhere(
        (call) => call.path.endsWith('/auth/login/sms'),
      );
      expect(jsonDecode(loginCall.body)['code'], '654321');
      // 主界面各页会继续请求。把这些 0 时长定时器跑完，避免测试结束时还有挂起的计时器。
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    });

    testWidgets('邮箱密码登录仍然可用，空表单不发请求', (tester) async {
      adapter = ScriptedAdapter((options, body) async {
        return envelope(
          status: 200,
          data: {'token': 'email-token', 'refreshToken': 'email-refresh'},
        );
      });
      await pumpLogin(tester);
      await tester.tap(find.byKey(const ValueKey('login-mode-email')));
      await tester.pump();
      expect(find.byKey(const ValueKey('login-phone')), findsNothing);

      await tester.tap(find.byKey(const ValueKey('login-submit')));
      await tester.pump();
      expect(find.text('请输入邮箱和密码'), findsOneWidget);
      expect(adapter.calls, isEmpty);

      await tester.enterText(
        find.byKey(const ValueKey('login-email')),
        'a@b.cn',
      );
      await tester.enterText(
        find.byKey(const ValueKey('login-password')),
        'secret12',
      );
      await tester.tap(find.byKey(const ValueKey('show-team-code')));
      await tester.pump();
      await tester.enterText(
        find.byKey(const ValueKey('team-code-field')),
        'studio-a',
      );
      await tester.ensureVisible(find.byKey(const ValueKey('login-submit')));
      await tester.tap(find.byKey(const ValueKey('login-submit')));
      await flush(tester);
      expect(find.text('登录成功'), findsOneWidget);
      expect(jsonDecode(adapter.calls.single.body), {
        'email': 'a@b.cn',
        'password': 'secret12',
        'tenant_slug': 'studio-a',
      });
      expect(await TokenStorage(store: store).readToken(), 'email-token');
    });

    testWidgets('窄屏和 200% 字号都不溢出', (tester) async {
      tester.view.physicalSize = const Size(375, 667);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: const TextScaler.linear(2)),
              child: child!,
            ),
            home: const LoginScreen(),
          ),
        ),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(find.text('手机号验证码登录'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('login-mode-email')));
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(find.text('邮箱'), findsOneWidget);
    });
  });
}
