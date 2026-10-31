import '../../core/illustrated_gl.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../data/models.dart';

/// Own-data overview from GET /analytics/overview: publishing tasks by real status, AI generations and adoption,
/// failure reasons, and an honest note while platform engagement data is not connected.
class OverviewSection extends ConsumerStatefulWidget {
  const OverviewSection({super.key});

  @override
  ConsumerState<OverviewSection> createState() => _OverviewSectionState();
}

class _OverviewSectionState extends ConsumerState<OverviewSection> {
  bool _month = false;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(analyticsOverviewProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GlSectionTitle(icon: Icons.insights, title: 'Publishing & AI'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(children: [
            ChoiceChip(label: const Text('This week'), selected: !_month, onSelected: (_) => setState(() => _month = false)),
            const SizedBox(width: 8),
            ChoiceChip(label: const Text('This month'), selected: _month, onSelected: (_) => setState(() => _month = true)),
          ]),
        ),
        const SizedBox(height: 12),
        async.when(
          loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
          error: (_, __) => const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Text('We could not load this just now. Pull down to try again.', style: TextStyle(fontSize: 14, height: 1.5)),
          ),
          data: (o) => _body(context, o),
        ),
      ],
    );
  }

  Widget _card(BuildContext context, Widget child) => Container(
        width: double.infinity,
        margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
        child: child,
      );

  Widget _body(BuildContext context, AnalyticsOverview o) {
    final p = _month ? o.month : o.week;
    final pub = p.publish;
    final ai = p.ai;
    final statusRows = <(String, int)>[
      ('Published', pub.published),
      ('Failed', pub.failed),
      ('In progress', pub.inProgress),
      ('Manual: open', pub.manualPending),
      ('Manual: done', pub.manualDone),
      ('Cancelled', pub.cancelled),
    ].where((r) => r.$2 > 0).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _card(
          context,
          pub.total == 0
              ? GlEmptyState(asset: 'assets/images/cfg_empty_insights.webp', title: 'No publishing tasks in this period', message: 'Scheduled tasks are counted here by their real status.')
              : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    GlStatTile(icon: Icons.check_circle_outline, label: 'Published', value: '${pub.published + pub.manualDone}', color: Colors.green.shade700),
                    const SizedBox(width: 10),
                    GlStatTile(icon: Icons.error_outline, label: 'Failed', value: '${pub.failed}', color: Colors.red.shade700),
                    const SizedBox(width: 10),
                    GlStatTile(icon: Icons.schedule, label: 'In progress', value: '${pub.inProgress + pub.manualPending}', color: Colors.blue.shade700),
                  ]),
                  const SizedBox(height: 14),
                  Text('Publishing status', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 6),
                  GlBarChart(rows: [for (final r in statusRows) (r.$1, r.$2.toDouble(), '${r.$2}')]),
                ]),
        ),
        _card(
          context,
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('AI generation', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 10),
            if (ai.generations == 0)
              const Text('Nothing was generated with AI in this period.', style: TextStyle(fontSize: 14, height: 1.5))
            else ...[
              Row(children: [
                GlStatTile(icon: Icons.auto_awesome, label: 'AI generations', value: '${ai.generations}', color: Colors.purple.shade700),
                const SizedBox(width: 10),
                GlStatTile(icon: Icons.bookmark_added_outlined, label: 'Saved to library', value: '${ai.savedAsContent}', color: Colors.teal.shade700),
                const SizedBox(width: 10),
                GlStatTile(icon: Icons.verified_outlined, label: 'Approved', value: '${ai.approvedOrPublished}', color: Colors.green.shade700),
              ]),
              const SizedBox(height: 12),
              Text('What was generated', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 4),
              GlBarChart(color: Colors.purple.shade700, rows: [for (final r in ai.byType) (r.label, r.count.toDouble(), '${r.count}')]),
            ],
          ]),
        ),
        _card(
          context,
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Failure reasons this month', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 8),
            if (o.failureReasons.isEmpty)
              const Text('No publishing tasks failed this month.', style: TextStyle(fontSize: 14, height: 1.5))
            else
              for (final r in o.failureReasons)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(Icons.error_outline, size: 18, color: Colors.red.shade700),
                    const SizedBox(width: 8),
                    Expanded(child: Text(r.reason, style: const TextStyle(fontSize: 14, height: 1.4))),
                    const SizedBox(width: 8),
                    Text('${r.count}×', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.red.shade700)),
                  ]),
                ),
          ]),
        ),
        if (!o.engagementAvailable && o.engagementMessage.isNotEmpty)
          _card(
            context,
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(Icons.lock_outline, size: 22, color: Colors.grey.shade700),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Engagement data · ${o.engagementMessage}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  if (o.engagementDetail.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(o.engagementDetail, style: const TextStyle(fontSize: 14, height: 1.5)),
                  ],
                ]),
              ),
            ]),
          ),
      ],
    );
  }
}
