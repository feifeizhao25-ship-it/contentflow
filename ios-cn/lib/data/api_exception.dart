import 'package:dio/dio.dart';

/// 合规检查命中的一条规则（发布前检查拦截时由后端放在 error.compliance.hits 里）。
class ComplianceHit {
  final String ruleId;
  final bool blocking;
  final String reason;
  final List<String> matchedTerms;

  const ComplianceHit({required this.ruleId, required this.blocking, required this.reason, this.matchedTerms = const []});

  static List<ComplianceHit> parseList(Object? raw) {
    if (raw is! List) return const [];
    final out = <ComplianceHit>[];
    for (final item in raw) {
      if (item is! Map) continue;
      final reason = item['reason'];
      if (reason is! String || reason.isEmpty) continue;
      final terms = item['matchedTerms'];
      out.add(ComplianceHit(
        ruleId: item['ruleId'] is String ? item['ruleId'] as String : '',
        blocking: item['severity'] == 'block',
        reason: reason,
        matchedTerms: terms is List ? terms.whereType<String>().toList() : const [],
      ));
    }
    return out;
  }
}

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  /// 被合规检查拦下时命中的规则；其他错误为空。
  final List<ComplianceHit> hits;

  /// True when the connection or the response timed out (the apps offer a retry for these).
  final bool timedOut;

  ApiException(this.message, {this.statusCode, this.timedOut = false, this.hits = const []});

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
        final compliance = err is Map ? err['compliance'] : null;
        return ApiException(
          msg,
          statusCode: statusCode,
          hits: compliance is Map ? ComplianceHit.parseList(compliance['hits']) : const [],
        );
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
        return ApiException(statusMessage(statusCode), statusCode: statusCode);
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
