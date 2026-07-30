// ContentFlow Mobile - 中文版配置
class AppConfig {
  static const region = 'CN';
  static const locale = 'zh-CN';
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.fenfa.cn/v1',
  );

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
