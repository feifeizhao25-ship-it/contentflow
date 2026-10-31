import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  /// True when the connection or the response timed out (the apps offer a retry for these).
  final bool timedOut;

  ApiException(this.message, {this.statusCode, this.timedOut = false});

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

  /// Plain-English message for an HTTP status when the server gave nothing usable to show.
  static String statusMessage(int? statusCode) {
    switch (statusCode) {
      case 400:
        return 'The request was not accepted. Please check your topic and try again.';
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 402:
      case 403:
        return 'Your plan does not include this. Check your plan on the web dashboard.';
      case 404:
        return 'Not found.';
      case 409:
        return 'This action conflicts with another request. Please try again.';
      case 422:
        return 'Invalid input. Please check and try again.';
      case 429:
        return 'Too many requests, or your monthly quota is used up. Please try again later.';
      default:
        if (statusCode != null && statusCode >= 500) {
          return 'The service is temporarily unavailable. Please try again later.';
        }
        return 'Unexpected server response.';
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
          statusCode: statusCode, timedOut: true,
        );
      case DioExceptionType.sendTimeout:
        return ApiException(
          'Request timed out while sending.',
          statusCode: statusCode, timedOut: true,
        );
      case DioExceptionType.receiveTimeout:
        return ApiException(
          'Response timed out. Please retry.',
          statusCode: statusCode, timedOut: true,
        );
      case DioExceptionType.badResponse:
        return ApiException(statusMessage(statusCode), statusCode: statusCode);
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
