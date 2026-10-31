import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../data/subscription_status.dart';

/// 套餐与用量：全部来自服务端 GET /billing/subscription，没有本地推算或占位数字。
final subscriptionStatusProvider = FutureProvider.autoDispose<SubscriptionStatus>((ref) {
  return ref.read(apiClientProvider).getSubscriptionStatus();
});

String _num(int n) {
  final s = n.abs().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(',');
    b.write(s[i]);
  }
  return n < 0 ? '-$b' : b.toString();
}

String _planName(String plan) {
  switch (plan) {
    case 'free':
      return '免费版';
    case 'pro':
      return 'Solo';
    case 'team':
      return 'Team';
    case 'enterprise':
      return 'Business';
    default:
      return plan;
  }
}

String _date(DateTime d) => '${d.year}年${d.month}月${d.day}日';

String _limit(int v) => v == -1 ? '不限' : _num(v);

/// 账号页里的紧凑卡片：显示本月 AI 额度，点开进入完整页面。
class PlanUsageCard extends ConsumerWidget {
  const PlanUsageCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(subscriptionStatusProvider);
    return Container(
      margin: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Semantics(
        button: true,
        label: '套餐与用量',
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlanUsageScreen())),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Expanded(child: Text('套餐与用量', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
                  const Icon(Icons.chevron_right, color: Colors.grey),
                ]),
                const SizedBox(height: 12),
                status.when(
                  loading: () => const LinearProgressIndicator(value: 0.0),
                  error: (_, __) => const Text('暂时无法获取套餐与用量，请稍后重试', style: TextStyle(color: Colors.grey)),
                  data: (s) => _AiBar(status: s),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AiBar extends StatelessWidget {
  final SubscriptionStatus status;
  const _AiBar({required this.status});

  @override
  Widget build(BuildContext context) {
    final t = status.aiTokens;
    final fraction = t.fraction;
    final String summary;
    if (status.quotaUnconfirmed) {
      summary = '额度待确认';
    } else if (t.unlimited) {
      summary = '本月已用 {used} 令牌（不限量）'.replaceAll('{used}', _num(t.used));
    } else {
      summary = '本月已用 {used} / {limit} 令牌'.replaceAll('{used}', _num(t.used)).replaceAll('{limit}', _num(t.limit));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('本月 AI 额度', style: const TextStyle(fontSize: 14)),
        const SizedBox(height: 8),
        if (fraction != null && !status.quotaUnconfirmed)
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 8,
              backgroundColor: Colors.grey.shade200,
              valueColor: AlwaysStoppedAnimation(fraction > 0.8 ? Colors.red : Colors.blue),
            ),
          ),
        const SizedBox(height: 6),
        Text(summary, style: const TextStyle(fontSize: 12, color: Colors.black54)),
      ],
    );
  }
}

class PlanUsageScreen extends ConsumerWidget {
  const PlanUsageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(subscriptionStatusProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('套餐与用量')),
      body: status.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Text('暂时无法获取套餐与用量，请稍后重试', textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: () => ref.invalidate(subscriptionStatusProvider), child: const Text('重试')),
            ]),
          ),
        ),
        data: (s) => _Body(status: s),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  final SubscriptionStatus status;
  const _Body({required this.status});

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final l = status.limits;
    final pending = status.quotaUnconfirmed;
    String lim(String key) => pending ? '待确认' : (l.containsKey(key) ? _limit(l[key]!) : '—');
    final t = status.aiTokens;
    final remaining = t.unlimited ? '不限' : _num(t.remaining);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('当前套餐', style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 4),
              Text(_planName(status.plan), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              if (status.expired) ...[
                const SizedBox(height: 8),
                Text('套餐已到期，现按免费版额度计算', style: const TextStyle(color: Colors.red)),
              ],
              if (status.renewalDate != null && !status.expired) ...[
                const SizedBox(height: 8),
                Text('套餐有效期至 {date}'.replaceAll('{date}', _date(status.renewalDate!))),
              ],
              if (status.renewalNotice != null) ...[
                const SizedBox(height: 8),
                Text(status.renewalNotice!, style: const TextStyle(color: Colors.black54)),
              ],
            ]),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('本月 AI 额度', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              _AiBar(status: status),
              const SizedBox(height: 8),
              if (!pending) _row('剩余令牌', remaining),
              if (t.reserved > 0) _row('生成中占用', _num(t.reserved)),
              if (t.imageTokenEquivalent != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text('生成 1 张图片计 {n} 令牌。'.replaceAll('{n}', _num(t.imageTokenEquivalent!)), style: const TextStyle(fontSize: 12, color: Colors.black54)),
                ),
              const SizedBox(height: 4),
              Text('统计月份 {period}（北京时间自然月）。'.replaceAll('{period}', status.period), style: const TextStyle(fontSize: 12, color: Colors.black54)),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('套餐上限', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              _row('平台账号数', lim('max_accounts')),
              _row('每月发布条数', lim('max_publishes_monthly')),
              _row('团队成员数', l.containsKey('max_members') ? _limit(l['max_members']!) : '—'),
              _row('存储空间', l.containsKey('max_storage_gb') ? (l['max_storage_gb'] == -1 ? '不限' : '${l['max_storage_gb']} GB') : '—'),
              const SizedBox(height: 4),
              Text('这里只显示套餐的上限；已发布条数等用量暂未在此显示。', style: const TextStyle(fontSize: 12, color: Colors.black54)),
            ]),
          ),
        ),
      ],
    );
  }
}
