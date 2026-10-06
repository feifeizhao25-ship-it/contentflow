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

  /// 网页端地址：优先 --dart-define=WEB_BASE_URL；没给时用 API 地址去掉 /api/v1（同域部署）。
  static const _configuredWebBaseUrl = String.fromEnvironment('WEB_BASE_URL');

  static String get webBaseUrl => deriveWebBaseUrl(_configuredWebBaseUrl, _configuredApiBaseUrl);

  static String deriveWebBaseUrl(String web, String api) {
    final explicit = web.trim().replaceFirst(RegExp(r'/$'), '');
    if (explicit.startsWith('https://')) return explicit;
    final normalizedApi = api.trim().replaceFirst(RegExp(r'/$'), '');
    return normalizedApi.replaceFirst(RegExp(r'/api/v1$'), '');
  }

  static String get privacyUrl => '$webBaseUrl/privacy';
  static String get termsUrl => '$webBaseUrl/terms';

  /// 网页端「设置 → 账号与数据」：手机号注册、需要短信验证等情况在这里注销
  static String get accountSettingsUrl => '$webBaseUrl/settings';

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
