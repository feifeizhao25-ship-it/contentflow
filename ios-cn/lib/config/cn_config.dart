// ContentFlow Mobile - 中文版配置
class AppConfig {
  static const region = 'CN';
  static const locale = 'zh-CN';
  static const _configuredApiBaseUrl = String.fromEnvironment('API_BASE_URL');

  static String get apiBaseUrl => validateApiBaseUrl(_configuredApiBaseUrl);

  static String validateApiBaseUrl(String value) {
    final normalized = value.trim().replaceFirst(RegExp(r'/$'), '');
    final uri = Uri.tryParse(normalized);
    if (normalized.isEmpty ||
        uri == null ||
        uri.scheme != 'https' ||
        uri.host.isEmpty ||
        !uri.path.endsWith('/api/v1')) {
      throw StateError(
        'API_BASE_URL must be an explicit HTTPS URL ending in /api/v1',
      );
    }
    return normalized;
  }

  // 平台
  static const platforms = [
    {'id': 'douyin', 'name': '抖音'},
    {'id': 'xiaohongshu', 'name': '小红书'},
    {'id': 'wechat', 'name': '微信'},
    {'id': 'weibo', 'name': '微博'},
  ];

  // 支付
  static const currency = 'CNY';
  static const paymentMethods = ['alipay', 'wechat_pay'];
}
