import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../data/models.dart';

class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedulesAsync = ref.watch(todaySchedulesProvider);
    final analyticsAsync = ref.watch(analyticsSummaryProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(todaySchedulesProvider);
            ref.invalidate(analyticsSummaryProvider);
          },
          child: CustomScrollView(
            slivers: [
              // Header
              SliverToBoxAdapter(
                child: _buildHeader(context),
              ),

              // Today's Date
              SliverToBoxAdapter(
                child: _buildDateHeader(context),
              ),

              // Schedule Tasks
              SliverToBoxAdapter(
                child: _buildSectionTitle('Today\'s publishing tasks'),
              ),

              schedulesAsync.when(
                data: (schedules) => _buildScheduleList(context, ref, schedules),
                loading: () => const SliverToBoxAdapter(
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => SliverToBoxAdapter(
                  child: Center(child: Text('Failed to load: $e')),
                ),
              ),

              // Analytics Summary
              SliverToBoxAdapter(
                child: _buildSectionTitle('Recent performance'),
              ),

              analyticsAsync.when(
                data: (summary) => _buildAnalyticsSummary(context, summary),
                loading: () => const SliverToBoxAdapter(
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => const SliverToBoxAdapter(
                  child: SizedBox.shrink(),
                ),
              ),

              const SliverToBoxAdapter(
                child: SizedBox(height: 100),
              ),
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
          const Text(
            '📅',
            style: TextStyle(fontSize: 28),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ContentFlow',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).primaryColor,
                  ),
                ),
                const Text(
                  'Content growth assistant',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDateHeader(BuildContext context) {
    final now = DateTime.now();
    final weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Theme.of(context).primaryColor,
            Theme.of(context).primaryColor.withValues(alpha: 0.8),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                DateFormat('MMM d').format(now),
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              Text(
                weekdays[now.weekday - 1],
                style: const TextStyle(
                  fontSize: 16,
                  color: Colors.white70,
                ),
              ),
            ],
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              'Week ${_getWeekNumber(now)}',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  int _getWeekNumber(DateTime date) {
    final firstDayOfYear = DateTime(date.year, 1, 1);
    final daysDifference = date.difference(firstDayOfYear).inDays;
    return ((daysDifference + firstDayOfYear.weekday - 1) / 7).ceil();
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildScheduleList(BuildContext context, WidgetRef ref, List<Schedule> schedules) {
    if (schedules.isEmpty) {
      return SliverToBoxAdapter(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 20),
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Center(
            child: Text(
              'No tasks scheduled today',
              style: TextStyle(color: Colors.grey),
            ),
          ),
        ),
      );
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) => _buildScheduleCard(context, ref, schedules[index]),
        childCount: schedules.length,
      ),
    );
  }

  Widget _buildScheduleCard(BuildContext context, WidgetRef ref, Schedule schedule) {
    final isFailed = schedule.status == ScheduleStatus.failed;
    final isPending = [
      ScheduleStatus.pending,
      ScheduleStatus.scheduled,
      ScheduleStatus.queued,
    ].contains(schedule.status);
    final isConfirmed = schedule.status == ScheduleStatus.confirmed;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: isFailed
            ? Border.all(color: Colors.red.shade300, width: 2)
            : null,
      ),
      child: Column(
        children: [
          // Status Banner
          if (isFailed)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, color: Colors.red, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Publish failed',
                    style: TextStyle(
                      color: Colors.red,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Platform & Time
                Row(
                  children: [
                    _buildPlatformIcon(schedule.platform),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _getPlatformName(schedule.platform),
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                          Text(
                            DateFormat('HH:mm').format(schedule.publishTime),
                            style: const TextStyle(
                              color: Colors.grey,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _buildStatusChip(schedule.status),
                  ],
                ),

                const SizedBox(height: 12),

                // Title
                Text(
                  schedule.title ?? 'Untitled content',
                  style: const TextStyle(fontSize: 15),
                ),

                // Error Message
                if (isFailed && schedule.errorMessage != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Reason: ${schedule.errorMessage}',
                    style: TextStyle(
                      color: Colors.red.shade400,
                      fontSize: 13,
                    ),
                  ),
                ],

                const SizedBox(height: 16),

                // Action Buttons
                Row(
                  children: [
                    if (isPending || isConfirmed)
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () async {
                            final api = ref.read(apiClientProvider);
                            await api.confirmPublish(schedule.id);
                            ref.invalidate(todaySchedulesProvider);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Theme.of(context).primaryColor,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: const Text('Confirm publish'),
                        ),
                      ),
                    if (isFailed)
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () async {
                            final api = ref.read(apiClientProvider);
                            await api.retryPublish(schedule.id);
                            ref.invalidate(todaySchedulesProvider);
                          },
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.orange,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                        ),
                      ),
                    if (isPending || isConfirmed) ...[
                      const SizedBox(width: 12),
                      OutlinedButton(
                        onPressed: () {
                          // TODO: Navigate to edit
                        },
                        child: const Text('Reschedule'),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlatformIcon(String platform) {
    IconData icon;
    Color color;

    switch (platform.toLowerCase()) {
      case 'douyin':
        icon = Icons.music_note;
        color = Colors.black;
        break;
      case 'xiaohongshu':
        icon = Icons.book;
        color = Colors.red;
        break;
      case 'bilibili':
        icon = Icons.tv;
        color = Colors.blue;
        break;
      case 'weibo':
        icon = Icons.public;
        color = Colors.orange;
        break;
      default:
        icon = Icons.smart_display;
        color = Colors.grey;
    }

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, color: color, size: 24),
    );
  }

  String _getPlatformName(String platform) {
    switch (platform.toLowerCase()) {
      case 'douyin':
        return 'Douyin';
      case 'xiaohongshu':
        return 'Xiaohongshu';
      case 'bilibili':
        return 'Bilibili';
      case 'weibo':
        return 'Weibo';
      default:
        return platform;
    }
  }

  Widget _buildStatusChip(ScheduleStatus status) {
    Color color;
    String text;

    switch (status) {
      case ScheduleStatus.draft:
        color = Colors.grey;
        text = 'Draft';
        break;
      case ScheduleStatus.scheduled:
        color = Colors.amber;
        text = 'Scheduled';
        break;
      case ScheduleStatus.queued:
        color = Colors.blueGrey;
        text = 'Queued';
        break;
      case ScheduleStatus.uploading:
        color = Colors.blue;
        text = 'Uploading';
        break;
      case ScheduleStatus.submitting:
        color = Colors.blue;
        text = 'Submitting';
        break;
      case ScheduleStatus.reviewing:
        color = Colors.indigo;
        text = 'Reviewing';
        break;
      case ScheduleStatus.pending:
        color = Colors.orange;
        text = 'Pending';
        break;
      case ScheduleStatus.confirmed:
        color = Colors.blue;
        text = 'Confirmed';
        break;
      case ScheduleStatus.publishing:
        color = Colors.purple;
        text = 'Publishing';
        break;
      case ScheduleStatus.retrying:
        color = Colors.orange;
        text = 'Retrying';
        break;
      case ScheduleStatus.published:
        color = Colors.green;
        text = 'Published';
        break;
      case ScheduleStatus.failed:
        color = Colors.red;
        text = 'Failed';
        break;
      case ScheduleStatus.canceled:
        color = Colors.grey;
        text = 'Canceled';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _buildAnalyticsSummary(BuildContext context, AnalyticsSummary summary) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildStatItem(
            context,
            'Views',
            _formatNumber(summary.totalViews),
            Icons.play_circle_outline,
          ),
          _buildStatItem(
            context,
            'Engagement',
            _formatNumber(summary.totalEngagement),
            Icons.thumb_up_outlined,
          ),
          _buildStatItem(
            context,
            'Content',
            '${summary.totalContent}',
            Icons.article_outlined,
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(BuildContext context, String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: Theme.of(context).primaryColor, size: 28),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: Colors.grey,
            fontSize: 12,
          ),
        ),
      ],
    );
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
