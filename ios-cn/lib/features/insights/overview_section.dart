import '../../core/illustrated.dart';
import '../../core/app_theme.dart';
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
        CfSectionTitle(icon: Icons.insights, title: '发布与生成'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(children: [
            ChoiceChip(label: const Text('本周'), selected: !_month, onSelected: (_) => setState(() => _month = false)),
            const SizedBox(width: 8),
            ChoiceChip(label: const Text('本月'), selected: _month, onSelected: (_) => setState(() => _month = true)),
          ]),
        ),
        const SizedBox(height: 12),
        async.when(
          loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
          error: (_, __) => const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Text('数据暂时没加载出来，下拉刷新再试一次。', style: TextStyle(fontSize: 14, height: 1.5)),
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
        decoration: BoxDecoration(color: AppColors.card(context), borderRadius: BorderRadius.circular(16)),
        child: child,
      );

  Widget _body(BuildContext context, AnalyticsOverview o) {
    final p = _month ? o.month : o.week;
    final pub = p.publish;
    final ai = p.ai;
    final statusRows = <(String, int)>[
      ('已发布', pub.published),
      ('失败', pub.failed),
      ('进行中', pub.inProgress),
      ('待人工发布', pub.manualPending),
      ('人工已发布', pub.manualDone),
      ('已取消', pub.cancelled),
    ].where((r) => r.$2 > 0).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _card(
          context,
          pub.total == 0
              ? CfEmptyState(asset: 'assets/images/cf_empty_insights.webp', title: '这段时间还没有发布任务', message: '排好的发布任务会按真实状态统计在这里。')
              : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    CfStatTile(icon: Icons.check_circle_outline, label: '已发布', value: '${pub.published + pub.manualDone}', color: Colors.green.shade700),
                    const SizedBox(width: 10),
                    CfStatTile(icon: Icons.error_outline, label: '失败', value: '${pub.failed}', color: Colors.red.shade700),
                    const SizedBox(width: 10),
                    CfStatTile(icon: Icons.schedule, label: '进行中', value: '${pub.inProgress + pub.manualPending}', color: Colors.blue.shade700),
                  ]),
                  const SizedBox(height: 14),
                  Text('发布任务分布', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 6),
                  CfBarChart(rows: [for (final r in statusRows) (r.$1, r.$2.toDouble(), '${r.$2}')]),
                ]),
        ),
        _card(
          context,
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('AI 生成', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 10),
            if (ai.generations == 0)
              const Text('这段时间没有用 AI 生成过内容。', style: TextStyle(fontSize: 14, height: 1.5))
            else ...[
              Row(children: [
                CfStatTile(icon: Icons.auto_awesome, label: 'AI 生成', value: '${ai.generations}', color: Colors.purple.shade700),
                const SizedBox(width: 10),
                CfStatTile(icon: Icons.bookmark_added_outlined, label: '保存进内容库', value: '${ai.savedAsContent}', color: Colors.teal.shade700),
                const SizedBox(width: 10),
                CfStatTile(icon: Icons.verified_outlined, label: '已通过或已发布', value: '${ai.approvedOrPublished}', color: Colors.green.shade700),
              ]),
              const SizedBox(height: 12),
              Text('生成类型', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 4),
              CfBarChart(color: Colors.purple.shade700, rows: [for (final r in ai.byType) (r.label, r.count.toDouble(), '${r.count}')]),
            ],
          ]),
        ),
        _card(
          context,
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('本月失败原因', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 8),
            if (o.failureReasons.isEmpty)
              const Text('本月没有发布失败的任务。', style: TextStyle(fontSize: 14, height: 1.5))
            else
              for (final r in o.failureReasons)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(Icons.error_outline, size: 18, color: Colors.red.shade700),
                    const SizedBox(width: 8),
                    Expanded(child: Text(r.reason, style: const TextStyle(fontSize: 14, height: 1.4))),
                    const SizedBox(width: 8),
                    Text('${r.count} 次', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.red.shade700)),
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
                  Text('互动数据 · ${o.engagementMessage}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
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
