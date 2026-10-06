import '../data/api_exception.dart';

/// 把异常换成给用户看的中文提示。
///
/// 原来 6 处直接把原始异常上屏（「加载失败: \$e」），用户会看到 DioException、
/// SocketException、英文堆栈等。现在：后端给的中文原样显示；其余一律用中文兜底，绝不显示异常原文。
String friendlyError(Object? error, {String fallback = '加载失败，请稍后重试'}) {
  if (error is ApiException) {
    if (_hasChinese(error.message)) return error.message; // 如「密码不正确」（注销时也是 401）
    if (error.statusCode == 401) return '登录已失效，请重新登录';
    return fallback;
  }
  return fallback;
}

bool _hasChinese(String text) => RegExp(r'[\u4e00-\u9fff]').hasMatch(text);
