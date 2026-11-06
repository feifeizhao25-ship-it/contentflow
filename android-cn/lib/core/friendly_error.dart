import 'package:flutter/material.dart';

const String kLoadingMessage = '正在加载。如果一直停在这里，请检查网络，然后返回重试。你的内容没有被发出。';

/// 生产环境不用红色错误屏。崩溃时给出下一步，不把内容发出去。
void installFriendlyErrorWidget() {
  ErrorWidget.builder = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    return const Directionality(
      textDirection: TextDirection.ltr,
      child: ColoredBox(
        color: Color(0xFFF8FAFC),
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              '页面出错了。请返回后重试。你的内容没有被发出。',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  };
}

class CfLoading extends StatelessWidget {
  const CfLoading({super.key, this.message = kLoadingMessage});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
