import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  /// 按状态码给出中文说明（后端没有给出可展示的中文原因时使用）。
  static String statusMessage(int? statusCode) {
    switch (statusCode) {
      case 400:
        return '提交的内容不符合要求，请修改主题后重试';
      case 401:
        return '登录已失效，请重新登录';
      case 402:
      case 403:
        return '当前套餐或权限不足，请在网页端查看套餐';
      case 404:
        return '没有找到对应的内容';
      case 409:
        return '操作冲突，请稍后重试';
      case 422:
        return '提交的内容格式不对，请检查后重试';
      case 429:
        return '请求太频繁或本月额度已用完，请稍后再试';
      default:
        if (statusCode != null && statusCode >= 500) {
          return '服务暂时不可用，请稍后重试';
        }
        return '服务器响应异常';
    }
  }

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
        return ApiException('连接超时，请检查网络', statusCode: statusCode);
      case DioExceptionType.sendTimeout:
        return ApiException('请求发送超时', statusCode: statusCode);
      case DioExceptionType.receiveTimeout:
        return ApiException('响应超时，请稍后重试', statusCode: statusCode);
      case DioExceptionType.badResponse:
        return ApiException(statusMessage(statusCode), statusCode: statusCode);
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
