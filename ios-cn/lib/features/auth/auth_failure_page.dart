import 'package:flutter/material.dart';

import '../../core/app_theme.dart';

/// 登录状态读失败时的兜底页。正常路径会直接进登录页；这里给重试和重新登录，避免再卡死。
class AuthFailurePage extends StatelessWidget {
  const AuthFailurePage({super.key, required this.onRetry, required this.onRelogin});

  final VoidCallback onRetry;
  final VoidCallback onRelogin;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).shortestSide >= 600;
    final titleSize = wide ? 28.0 : 22.0;
    final bodySize = wide ? 18.0 : 16.0;
    return Scaffold(
      backgroundColor: AppColors.page(context),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.lock_outline, size: wide ? 56 : 40, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(height: 16),
                  Text(
                    '暂时无法确认登录状态',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: titleSize, fontWeight: FontWeight.w700, color: Theme.of(context).colorScheme.onSurface),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '本机安全存储没有读到登录信息。可以重试，或直接重新登录。',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: bodySize, height: 1.5, color: AppColors.muted(context)),
                  ),
                  const SizedBox(height: 28),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(onPressed: onRetry, child: const Text('重试')),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton(onPressed: onRelogin, child: const Text('重新登录')),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
