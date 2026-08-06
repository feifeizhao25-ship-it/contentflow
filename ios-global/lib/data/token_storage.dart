import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const _tokenKey = 'ff_token';
  final FlutterSecureStorage _storage;

  TokenStorage({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  Future<String?> readToken() {
    return _storage.read(key: _tokenKey);
  }

  Future<void> writeToken(String token) {
    return _storage.write(key: _tokenKey, value: token);
  }

  Future<void> clearToken() {
    return _storage.delete(key: _tokenKey);
  }
}
