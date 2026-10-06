import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_cn/core/error_text.dart';
import 'package:contentflow_cn/data/api_exception.dart';
import 'package:contentflow_cn/config/cn_config.dart';

void main() {
  test('原始异常不上屏：英文异常一律换成中文兜底', () {
    expect(friendlyError(Exception('DioException [connection error]')), '加载失败，请稍后重试');
    expect(friendlyError(StateError('Bad state'), fallback: '上传失败，请稍后重试'), '上传失败，请稍后重试');
    expect(friendlyError(ApiException('Internal server error', statusCode: 500)), '加载失败，请稍后重试');
  });

  test('后端给的中文提示原样显示；401 提示重新登录', () {
    expect(friendlyError(ApiException('本月 AI 额度已用完', statusCode: 429)), '本月 AI 额度已用完');
    expect(friendlyError(ApiException('Unauthorized', statusCode: 401)), '登录已失效，请重新登录');
    expect(friendlyError(ApiException('密码不正确', statusCode: 401)), '密码不正确');
  });

  test('隐私政策 / 注销的网页地址从 API 地址推出', () {
    expect(AppConfig.deriveWebBaseUrl('', 'https://fenfa.example.cn/api/v1'), 'https://fenfa.example.cn');
    expect(AppConfig.deriveWebBaseUrl('https://www.example.cn/', 'https://api.example.cn/api/v1'), 'https://www.example.cn');
  });
}
