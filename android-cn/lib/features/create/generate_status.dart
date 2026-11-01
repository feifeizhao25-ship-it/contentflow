import 'package:flutter/material.dart';

import '../../data/api_exception.dart';

/// Progress and error/retry feedback for the (slow, multi-step) content-pack generation call.
class GenerateStatusCard extends StatelessWidget {
  final bool generating;
  final int elapsedSeconds;
  final String? error;

  /// 被发布前合规检查拦下时命中的规则（为空则只显示 error）。
  final List<ComplianceHit> hits;
  final VoidCallback onRetry;

  const GenerateStatusCard({
    super.key,
    required this.generating,
    required this.elapsedSeconds,
    required this.error,
    this.hits = const [],
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (generating) {
      final elapsed = elapsedSeconds;
      return Semantics(
        liveRegion: true,
        label: '正在生成内容包…',
        child: Container(
          key: const ValueKey('generate-progress'),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: theme.primaryColor.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      '正在生成内容包…',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text(
                    '已用 $elapsed 秒',
                    style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: const LinearProgressIndicator(minHeight: 6),
              ),
              const SizedBox(height: 10),
              Text(
                '通常不到一分钟，请保持本页面打开，不要退出。',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              ),
            ],
          ),
        ),
      );
    }
    final message = error;
    if (message == null) return const SizedBox.shrink();
    return Semantics(
      liveRegion: true,
      child: Container(
        key: const ValueKey('generate-error'),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: theme.colorScheme.error.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: theme.colorScheme.error.withValues(alpha: 0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.error_outline, color: theme.colorScheme.error, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '生成没有完成',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: theme.colorScheme.error,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(message, style: const TextStyle(fontSize: 13)),
            if (hits.isNotEmpty) ...[
              const SizedBox(height: 10),
              const Text('命中的规则', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              for (final hit in hits)
                Padding(
                  key: ValueKey('compliance-hit-${hit.ruleId}'),
                  padding: const EdgeInsets.only(top: 6),
                  child: Text.rich(TextSpan(style: const TextStyle(fontSize: 13), children: [
                    TextSpan(
                      text: hit.blocking ? '【必须修改】' : '【建议核对】',
                      style: TextStyle(fontWeight: FontWeight.w600, color: hit.blocking ? theme.colorScheme.error : Colors.orange.shade800),
                    ),
                    TextSpan(text: hit.reason),
                    if (hit.matchedTerms.isNotEmpty) TextSpan(text: '（涉及：${hit.matchedTerms.map((t) => '「$t」').join('、')}）'),
                    if (hit.ruleId.isNotEmpty) TextSpan(text: '  规则编号 ${hit.ruleId}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                  ])),
                ),
              const SizedBox(height: 4),
              Text('请按提示修改主题或要点后重新生成。这不是法律意见。', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            ],
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('重新生成'),
            ),
          ],
        ),
      ),
    );
  }
}
