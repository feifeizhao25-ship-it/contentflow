import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  factory ApiException.fromDio(DioException error) {
    final statusCode = error.response?.statusCode;
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final msg = data['message'] ?? data['error'];
      if (msg is String && msg.isNotEmpty) {
        return ApiException(msg, statusCode: statusCode);
      }
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
        return ApiException('连接超时，请检查网络', statusCode: statusCode);
      case DioExceptionType.sendTimeout:
        return ApiException('请求发送超时', statusCode: statusCode);
      case DioExceptionType.receiveTimeout:
        return ApiException('响应超时，请稍后重试', statusCode: statusCode);
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
    }
  }

  @override
  String toString() => message;
}
