import '../../core/illustrated.dart';
import '../../core/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../core/cn_format.dart';
import '../../data/models.dart';
import 'overview_section.dart';
import '../../core/error_text.dart';

class InsightsScreen extends ConsumerWidget {
  const InsightsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contentAsync = ref.watch(contentAnalyticsProvider);

    return Scaffold(
            body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(analyticsOverviewProvider);
            ref.invalidate(contentAnalyticsProvider);
          },
          child: CustomScrollView(
            slivers: [
              // Header
              SliverToBoxAdapter(child: _buildHeader(context)),

              // Own-data overview (GET /analytics/overview)
              const SliverToBoxAdapter(child: OverviewSection()),

              // Winner Alert
              contentAsync.when(
                data: (contents) {
                  if (contents.isEmpty) {
                    return const SliverToBoxAdapter(child: SizedBox.shrink());
                  }
                  final topContent = contents.first;
                  if (topContent.engagementRate > 0.05) {
                    return SliverToBoxAdapter(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const CfSectionTitle(icon: Icons.local_fire_department, title: '爆款提示'),
                          _buildWinnerAlert(context, topContent),
                        ],
                      ),
                    );
                  }
                  return const SliverToBoxAdapter(child: SizedBox.shrink());
                },
                loading: () =>
                    const SliverToBoxAdapter(child: SizedBox.shrink()),
                error: (_, __) =>
                    const SliverToBoxAdapter(child: SizedBox.shrink()),
              ),

              // 互动率对比（真实数据条形图；无数据时不显示）
              contentAsync.when(
                data: (contents) {
                  if (contents.isEmpty) {
                    return const SliverToBoxAdapter(child: SizedBox.shrink());
                  }
                  final top = [...contents]
                    ..sort((x, y) => y.engagementRate.compareTo(x.engagementRate));
                  final rows = top.take(6).map((c) => (
                        c.title.isEmpty ? '（无标题）' : c.title,
                        c.engagementRate,
                        '${(c.engagementRate * 100).toStringAsFixed(1)}%',
                      )).toList();
                  return SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const CfSectionTitle(icon: Icons.stacked_bar_chart, title: '互动率对比'),
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 20),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.card(context),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: CfBarChart(rows: rows),
                        ),
                      ],
                    ),
                  );
                },
                loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
                error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
              ),

              // Content List
              SliverToBoxAdapter(child: const CfSectionTitle(icon: Icons.list_alt, title: '内容列表')),

              contentAsync.when(
                data: (contents) => contents.isEmpty
                    ? const SliverToBoxAdapter(
                        child: CfEmptyState(
                          asset: 'assets/images/cf_empty_insights.webp',
                          title: '还没有可复盘的内容',
                          message: '每条内容的播放、互动和互动率，要等平台授权接通后才能显示，现在不会显示任何估算数字。',
                        ),
                      )
                    : SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) =>
                              _buildContentItem(context, contents[index]),
                          childCount: contents.length,
                        ),
                      ),
                loading: () => const SliverToBoxAdapter(
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) =>
                    SliverToBoxAdapter(child: Center(child: Text(friendlyError(e)))),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
            child: Icon(Icons.bar_chart_rounded, size: 26, color: Theme.of(context).colorScheme.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '数据复盘',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).primaryColor,
                  ),
                ),
                const Text(
                  '分析内容表现',
                  style: TextStyle(fontSize: 14, color: Colors.grey),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWinnerAlert(BuildContext context, ContentAnalytics content) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.orange.shade400, Colors.red.shade400],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.local_fire_department, color: Colors.white),
              SizedBox(width: 8),
              Text(
                '本内容表现优秀!',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '这条内容的互动高于 5%。具体原因需要对照原文，这里不替你下结论。',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.9)),
          ),
        ],
      ),
    );
  }

  Widget _buildContentItem(BuildContext context, ContentAnalytics content) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  content.title,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _buildMetric(
                      Icons.play_arrow,
                      _formatNumber(content.views),
                      Colors.blue,
                    ),
                    const SizedBox(width: 16),
                    _buildMetric(
                      Icons.thumb_up,
                      _formatNumber(content.likes),
                      Colors.orange,
                    ),
                    const SizedBox(width: 16),
                    _buildMetric(
                      Icons.share,
                      _formatNumber(content.shares),
                      Colors.green,
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: _getEngagementColor(
                content.engagementRate,
              ).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '${(content.engagementRate * 100).toStringAsFixed(1)}%',
              style: TextStyle(
                color: _getEngagementColor(content.engagementRate),
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetric(IconData icon, String value, Color color) {
    return Row(
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(value, style: TextStyle(color: color, fontSize: 14)),
      ],
    );
  }

  Color _getEngagementColor(double rate) {
    if (rate > 0.1) return Colors.green.shade800;
    if (rate > 0.05) return Colors.orange.shade800;
    return const Color(0xFF3F3F46);
  }

  String _formatNumber(int number) => formatCount(number);
}
