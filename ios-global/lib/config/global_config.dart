// ContentFlow Mobile - Global Configuration
class AppConfig {
  static const region = 'GLOBAL';
  static const locale = 'en-US';
  static const _configuredApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://contentflow.tianji-astrology.com/api/v1',
  );

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

  // Platforms
  static const platforms = [
    {'id': 'twitter', 'name': 'Twitter'},
    {'id': 'youtube', 'name': 'YouTube'},
    {'id': 'instagram', 'name': 'Instagram'},
    {'id': 'tiktok', 'name': 'TikTok'},
  ];

  // Payment
  static const currency = 'USD';
  static const paymentMethods = ['stripe', 'paypal'];
}
