import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  /// True when the connection or the response timed out (the apps offer a retry for these).
  final bool timedOut;

  ApiException(this.message, {this.statusCode, this.timedOut = false});

  factory ApiException.fromDio(DioException error) {
    final statusCode = error.response?.statusCode;
    final data = error.response?.data;
    // 后端信封是 { success: false, error: { message } }，message 可能是字符串或字符串数组；
    // 只取中文，英文原文不上屏。
    if (data is Map<String, dynamic>) {
      final err = data['error'];
      final raw = err is Map ? err['message'] : (data['message'] ?? err);
      final msg = raw is List ? raw.whereType<String>().join('；') : raw;
      if (msg is String && RegExp(r'[\u4e00-\u9fff]').hasMatch(msg)) {
        return ApiException(msg, statusCode: statusCode);
      }
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
        return ApiException('连接超时，请检查网络', statusCode: statusCode, timedOut: true);
      case DioExceptionType.sendTimeout:
        return ApiException('请求发送超时', statusCode: statusCode, timedOut: true);
      case DioExceptionType.receiveTimeout:
        return ApiException('响应超时，请稍后重试', statusCode: statusCode, timedOut: true);
      case DioExceptionType.badResponse:
        return ApiException('服务器响应异常', statusCode: statusCode);
      case DioExceptionType.cancel:
        return ApiException('请求已取消', statusCode: statusCode);
      case DioExceptionType.badCertificate:
        return ApiException('证书校验失败', statusCode: statusCode);
      case DioExceptionType.connectionError:
        return ApiException('网络连接失败', statusCode: statusCode);
      case DioExceptionType.unknown:
        return ApiException('请求失败，请稍后再试', statusCode: statusCode);
      default:
        return ApiException('响应处理超时，请稍后重试', statusCode: statusCode);
    }
  }

  @override
  String toString() => message;
}
