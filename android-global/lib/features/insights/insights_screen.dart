import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/illustrated_gl.dart';
import '../../core/providers.dart';
import '../../data/models.dart';
import 'overview_section.dart';

class InsightsScreen extends ConsumerWidget {
  const InsightsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contentAsync = ref.watch(contentAnalyticsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
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
                  final top = ([...contents]..sort((x, y) => y.engagementRate.compareTo(x.engagementRate))).first;
                  if (top.engagementRate > 0.05) {
                    return SliverToBoxAdapter(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const GlSectionTitle(icon: Icons.local_fire_department, title: 'Top performer'),
                          _buildWinnerAlert(context, top),
                        ],
                      ),
                    );
                  }
                  return const SliverToBoxAdapter(child: SizedBox.shrink());
                },
                loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
                error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
              ),

              // Engagement comparison
              contentAsync.when(
                data: (contents) {
                  if (contents.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
                  final sorted = ([...contents]..sort((x, y) => y.engagementRate.compareTo(x.engagementRate))).take(6).toList();
                  return SliverToBoxAdapter(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const GlSectionTitle(icon: Icons.stacked_bar_chart, title: 'Engagement rate'),
                      Container(
                        margin: const EdgeInsets.symmetric(horizontal: 20),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                        child: GlBarChart(rows: [
                          for (final c in sorted) (c.title, c.engagementRate, '${(c.engagementRate * 100).toStringAsFixed(1)}%'),
                        ]),
                      ),
                    ]),
                  );
                },
                loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
                error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
              ),

              // Content List
              const SliverToBoxAdapter(child: GlSectionTitle(icon: Icons.list_alt, title: 'Content list')),

              contentAsync.when(
                data: (contents) => contents.isEmpty
                    ? const SliverToBoxAdapter(
                        child: GlEmptyState(
                          asset: 'assets/images/cfg_empty_insights.webp',
                          title: 'No content data yet',
                          message: 'Per-post views, engagement and rates appear once your platforms are connected. No estimated numbers are shown until then.',
                        ),
                      )
                    : SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) => _buildContentItem(context, contents[index]),
                          childCount: contents.length,
                        ),
                      ),
                loading: () => const SliverToBoxAdapter(
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => SliverToBoxAdapter(
                  child: Center(child: Text('Failed to load: $e')),
                ),
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
          const GlIconBadge(icon: Icons.bar_chart_rounded),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Performance review',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).primaryColor,
                  ),
                ),
                const Text(
                  'Analyze content performance',
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
                'This post is doing well',
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
            'This post\'s engagement rate is above 5%. Compare its hook and title with your other posts; this alone does not explain why.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.95), fontSize: 14.5, height: 1.5),
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
        color: Colors.white,
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
                    _buildMetric(Icons.play_arrow, _formatNumber(content.views), Colors.blue),
                    const SizedBox(width: 16),
                    _buildMetric(Icons.thumb_up, _formatNumber(content.likes), Colors.orange),
                    const SizedBox(width: 16),
                    _buildMetric(Icons.share, _formatNumber(content.shares), Colors.green),
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
        Text(value, style: TextStyle(color: color, fontSize: 13)),
      ],
    );
  }

  Color _getEngagementColor(double rate) {
    if (rate > 0.1) return Colors.green;
    if (rate > 0.05) return Colors.orange;
    return Colors.grey;
  }

  String _formatNumber(int number) {
    if (number >= 10000) {
      return '${(number / 10000).toStringAsFixed(1)}w';
    } else if (number >= 1000) {
      return '${(number / 1000).toStringAsFixed(1)}k';
    }
    return number.toString();
  }
}
