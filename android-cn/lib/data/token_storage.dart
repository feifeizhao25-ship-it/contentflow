import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_exception.dart';

/// 可替换的钥匙串读写，方便测试模拟「读失败」。
abstract class SecretStore {
  Future<String?> read({required String key});
  Future<void> write({required String key, required String value});
  Future<void> delete({required String key});
}

class FlutterSecretStore implements SecretStore {
  FlutterSecretStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read({required String key}) => _storage.read(key: key);

  @override
  Future<void> write({required String key, required String value}) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete({required String key}) => _storage.delete(key: key);
}

class TokenStorage {
  static const _tokenKey = 'ff_token';
  final SecretStore _store;

  TokenStorage({SecretStore? store}) : _store = store ?? FlutterSecretStore();

  /// 读不到令牌时按未登录处理，不要把启动卡死。
  ///
  /// iOS 上 `FlutterSecureStorage.read` 会调用 `SecItemCopyMatching`。
  /// 没有条目时返回 null；未签名的模拟器构建（`flutter run --no-codesign`）
  /// 没有钥匙串 entitlement，系统返回 `errSecMissingEntitlement`（-34018），
  /// 插件把它当成异常抛出。这里记下状态码、尝试删掉坏数据，然后当作没有登录。
  Future<String?> readToken() async {
    try {
      final token = await _store.read(key: _tokenKey);
      if (token == null || token.isEmpty) return null;
      return token;
    } catch (error, stack) {
      _log('读取登录状态失败，按未登录进入。${_detail(error)}', stack);
      try {
        await _store.delete(key: _tokenKey);
      } catch (deleteError, deleteStack) {
        _log('清理无法读取的登录状态失败。${_detail(deleteError)}', deleteStack);
      }
      return null;
    }
  }

  Future<void> writeToken(String token) async {
    try {
      await _store.write(key: _tokenKey, value: token);
    } catch (error, stack) {
      _log('保存登录状态失败。${_detail(error)}', stack);
      throw ApiException('登录状态无法写入本机安全存储，请使用已签名的安装包后再试');
    }
  }

  Future<void> clearToken() async {
    try {
      await _store.delete(key: _tokenKey);
    } catch (error, stack) {
      _log('清除登录状态失败。${_detail(error)}', stack);
    }
  }
}

String _detail(Object error) {
  if (error is PlatformException) {
    final code = error.code;
    final message = error.message ?? '';
    // -34018：未签名进程没有钥匙串 entitlement，SecItemCopyMatching 直接失败。
    return 'PlatformException code=$code message=$message'; // zh-gate:allow 诊断文字，不显示给用户
  }
  return error.runtimeType.toString();
}

void _log(String message, StackTrace stack) {
  // 只写调试日志。不要 FlutterError.reportError，否则调试模式会再盖一层红屏。
  debugPrint('分发侠：$message');
}
