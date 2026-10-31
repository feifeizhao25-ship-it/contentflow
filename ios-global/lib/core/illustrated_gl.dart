/// Image-rich building blocks for the international edition
/// (empty states, section titles, hero banner, bar chart, stat tiles).
library;

import 'package:flutter/material.dart';

class GlIconBadge extends StatelessWidget {
  const GlIconBadge({super.key, required this.icon});
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme.primary;
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
      child: Icon(icon, size: 24, color: c),
    );
  }
}

class GlEmptyState extends StatelessWidget {
  const GlEmptyState({super.key, required this.asset, required this.title, required this.message, this.action});
  final String asset;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset(asset, width: 168, height: 168, fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const SizedBox(width: 168, height: 168)),
          const SizedBox(height: 8),
          Text(title, textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, height: 1.35)),
          const SizedBox(height: 6),
          Text(message, textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14.5, height: 1.55, color: Color(0xFF52525B))),
          if (action != null) ...[const SizedBox(height: 14), action!],
        ],
      ),
    );
  }
}

class GlSectionTitle extends StatelessWidget {
  const GlSectionTitle({super.key, required this.icon, required this.title, this.padding = const EdgeInsets.fromLTRB(20, 18, 20, 12)});
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

/// Gradient card with copy on the left and a clay-style illustration on the right.
class GlHeroBanner extends StatelessWidget {
  const GlHeroBanner({super.key, required this.asset, required this.title, required this.subtitle, this.height = 148});
  final String asset;
  final String title;
  final String subtitle;
  final double height;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme.primary;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
      child: Container(
        height: height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(26),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [c.withValues(alpha: 0.16), const Color(0xFFFFF1E8)],
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Row(children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 4, 14),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontSize: 22, height: 1.25, fontWeight: FontWeight.w800, color: c)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(fontSize: 14, height: 1.45, color: Color(0xFF3F3F46))),
                ],
              ),
            ),
          ),
          Image.asset(asset, width: height, height: height, fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => SizedBox(width: height, height: height)),
        ]),
      ),
    );
  }
}

/// One row per item: label, bar proportional to the largest value, value text. Data comes from the caller untouched.
class GlBarChart extends StatelessWidget {
  const GlBarChart({super.key, required this.rows, this.color});
  final List<(String, double, String)> rows;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    final maxV = rows.fold<double>(0, (m, r) => r.$2 > m ? r.$2 : m);
    return Column(children: [
      for (final r in rows)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [
            SizedBox(width: 104, child: Text(r.$1, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, height: 1.4))),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: maxV <= 0 ? 0 : (r.$2 / maxV).clamp(0.0, 1.0),
                  minHeight: 12,
                  backgroundColor: c.withValues(alpha: 0.10),
                  valueColor: AlwaysStoppedAnimation(c),
                ),
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(width: 52, child: Text(r.$3, textAlign: TextAlign.right, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c))),
          ]),
        ),
    ]);
  }
}

class GlStatTile extends StatelessWidget {
  const GlStatTile({super.key, required this.icon, required this.label, required this.value, required this.color});
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(18)),
        child: Column(children: [
          Icon(icon, size: 22, color: color),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          FittedBox(fit: BoxFit.scaleDown, child: Text(label, maxLines: 1, style: const TextStyle(fontSize: 14, color: Color(0xFF3F3F46)))),
        ]),
      ),
    );
  }
}
