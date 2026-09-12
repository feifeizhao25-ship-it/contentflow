import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  // i18n guard: never surface raw Chinese backend messages (international build).
  static final RegExp _cjk = RegExp(r'[\u4e00-\u9fff]');

  static String sanitizeServerMessage(String raw, int? statusCode) {
    final msg = raw.trim();
    if (msg.isNotEmpty && !_cjk.hasMatch(msg)) return msg;
    switch (statusCode) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Incorrect email or password.';
      case 403:
        return 'Access denied.';
      case 404:
        return 'Not found.';
      case 409:
        return 'This account already exists.';
      case 422:
        return 'Invalid input. Please check and try again.';
      case 429:
        return 'Too many attempts. Please try again later.';
      default:
        return 'Server error${statusCode != null ? ' ($statusCode)' : ''}. Please try again later.';
    }
  }

  factory ApiException.fromDio(DioException error) {
    final statusCode = error.response?.statusCode;
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final msg = data['message'] ?? data['error'];
      if (msg is String && msg.isNotEmpty) {
        return ApiException(
          sanitizeServerMessage(msg, statusCode),
          statusCode: statusCode,
        );
      }
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
        return ApiException(
          'Connection timed out. Check your network.',
          statusCode: statusCode,
        );
      case DioExceptionType.sendTimeout:
        return ApiException(
          'Request timed out while sending.',
          statusCode: statusCode,
        );
      case DioExceptionType.receiveTimeout:
        return ApiException(
          'Response timed out. Please retry.',
          statusCode: statusCode,
        );
      case DioExceptionType.badResponse:
        return ApiException(
          'Unexpected server response.',
          statusCode: statusCode,
        );
      case DioExceptionType.cancel:
        return ApiException('Request cancelled.', statusCode: statusCode);
      case DioExceptionType.badCertificate:
        return ApiException(
          'Certificate validation failed.',
          statusCode: statusCode,
        );
      case DioExceptionType.connectionError:
        return ApiException(
          'Network connection failed.',
          statusCode: statusCode,
        );
      case DioExceptionType.unknown:
        return ApiException('Request failed. Please try again.', statusCode: statusCode);
    }
  }

  @override
  String toString() => message;
}
