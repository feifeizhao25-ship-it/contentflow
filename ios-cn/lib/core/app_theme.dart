import 'package:flutter/material.dart';

class AppTheme {
  static const _seed = Color(0xFF6366F1);

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(seedColor: _seed, brightness: Brightness.light);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: const Color(0xFFF4F5FB),
    );
  }

  static ThemeData dark() {
    final scheme = ColorScheme.fromSeed(seedColor: _seed, brightness: Brightness.dark);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
    );
  }
}

class AppColors {
  static Color card(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (scheme.brightness == Brightness.dark) {
      return Color.alphaBlend(const Color(0x14FFFFFF), scheme.surface);
    }
    return Colors.white;
  }

  static Color muted(BuildContext context) => Theme.of(context).colorScheme.onSurfaceVariant;

  static Color page(BuildContext context) => Theme.of(context).scaffoldBackgroundColor;
}

/// 大屏把内容收成一列，避免 iPad 上文字漂在空白中间。
class PageFrame extends StatelessWidget {
  const PageFrame({super.key, required this.child, this.maxWidth = 880});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}
