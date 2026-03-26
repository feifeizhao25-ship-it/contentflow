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
        return ApiException('Connection timed out. Check your network.', statusCode: statusCode);
      case DioExceptionType.sendTimeout:
        return ApiException('Request timed out while sending.', statusCode: statusCode);
      case DioExceptionType.receiveTimeout:
        return ApiException('Response timed out. Please retry.', statusCode: statusCode);
      case DioExceptionType.badResponse:
        return ApiException('Unexpected server response.', statusCode: statusCode);
      case DioExceptionType.cancel:
        return ApiException('Request cancelled.', statusCode: statusCode);
      case DioExceptionType.badCertificate:
        return ApiException('Certificate validation failed.', statusCode: statusCode);
      case DioExceptionType.connectionError:
        return ApiException('Network connection failed.', statusCode: statusCode);
      case DioExceptionType.unknown:
      default:
        return ApiException('Request failed. Please try again.', statusCode: statusCode);
    }
  }

  @override
  String toString() => message;
}
