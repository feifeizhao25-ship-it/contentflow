// ContentFlow Mobile - Global Configuration
class AppConfig {
  static const region = 'GLOBAL';
  static const locale = 'en-US';
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.fenfa.ai/v1',
  );
  
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
