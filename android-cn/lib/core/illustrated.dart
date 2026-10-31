/// 图文并茂的通用组件（空状态插画、区块标题、顶部横幅、数据条形图）。
library;

import 'package:flutter/material.dart';
import 'app_theme.dart';

class CfEmptyState extends StatelessWidget {
  const CfEmptyState({super.key, required this.asset, required this.title, required this.message, this.action});

  final String asset;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset(asset, width: 200, height: 150, fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const SizedBox(width: 200, height: 150)),
          const SizedBox(height: 12),
          Text(title, textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, height: 1.4)),
          const SizedBox(height: 6),
          Text(message, textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, height: 1.6, color: AppColors.muted(context))),
          if (action != null) ...[const SizedBox(height: 14), action!],
        ],
      ),
    );
  }
}

/// 带图标底座的区块标题
class CfSectionTitle extends StatelessWidget {
  const CfSectionTitle({super.key, required this.icon, required this.title, this.padding = const EdgeInsets.fromLTRB(20, 16, 20, 12)});

  final IconData icon;
  final String title;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme.primary;
    return Padding(
      padding: padding,
      child: Row(children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 18, color: c),
        ),
        const SizedBox(width: 10),
        Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

/// 页面顶部插画横幅（图片在右、文字在左）
class CfHeroBanner extends StatelessWidget {
  const CfHeroBanner({super.key, required this.asset, required this.title, required this.subtitle, this.height = 150});

  final String asset;
  final String title;
  final String subtitle;
  final double height;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: Stack(fit: StackFit.expand, children: [
            DecoratedBox(decoration: BoxDecoration(color: primary.withValues(alpha: 0.12))),
            Image.asset(asset, fit: BoxFit.cover, alignment: Alignment.centerRight,
                errorBuilder: (_, __, ___) => const SizedBox.shrink()),
            Positioned(
              left: 18,
              top: 0,
              bottom: 0,
              right: 120,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontSize: 24, height: 1.3, fontWeight: FontWeight.w800, color: primary)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(fontSize: 14, height: 1.5, color: Color(0xFF3F3F46))),
                ],
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/// 数据条形图：每行一个标签 + 与最大值成比例的进度条 + 数值文字。数据由调用方提供，不做任何补全。
class CfBarChart extends StatelessWidget {
  const CfBarChart({super.key, required this.rows, this.color});

  /// (标签, 数值, 显示文字)
  final List<(String, double, String)> rows;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    final maxV = rows.fold<double>(0, (m, r) => r.$2 > m ? r.$2 : m);
    return Column(
      children: [
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(children: [
              SizedBox(
                width: 92,
                child: Text(r.$1, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, height: 1.4)),
              ),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: maxV <= 0 ? 0 : (r.$2 / maxV).clamp(0.0, 1.0),
                    minHeight: 12,
                    backgroundColor: c.withValues(alpha: 0.10),
                    valueColor: AlwaysStoppedAnimation(c),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 52,
                child: Text(r.$3, textAlign: TextAlign.right, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c)),
              ),
            ]),
          ),
      ],
    );
  }
}

/// 数字指标卡（图标 + 数值 + 名称）
class CfStatTile extends StatelessWidget {
  const CfStatTile({super.key, required this.icon, required this.label, required this.value, required this.color});

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.09), borderRadius: BorderRadius.circular(14)),
        child: Column(children: [
          Icon(icon, size: 22, color: color),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 14, color: Color(0xFF3F3F46))),
        ]),
      ),
    );
  }
}
