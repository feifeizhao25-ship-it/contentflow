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
      return 'Free';
    case 'starter':
      return 'Starter';
    case 'pro':
      return 'Pro';
    case 'team':
      return 'Team';
    case 'enterprise':
      return 'Enterprise';
    default:
      return plan;
  }
}

String _date(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String _limit(int v) => v == -1 ? 'Unlimited' : _num(v);

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
        label: 'Plan & usage',
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlanUsageScreen())),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Expanded(child: Text('Plan & usage', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
                  const Icon(Icons.chevron_right, color: Colors.grey),
                ]),
                const SizedBox(height: 12),
                status.when(
                  loading: () => const LinearProgressIndicator(value: 0.0),
                  error: (_, __) => const Text('Could not load your plan and usage. Please try again.', style: TextStyle(color: Colors.grey)),
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
      summary = 'Quota pending confirmation';
    } else if (t.unlimited) {
      summary = '{used} tokens used this month (unlimited)'.replaceAll('{used}', _num(t.used));
    } else {
      summary = '{used} of {limit} tokens used this month'.replaceAll('{used}', _num(t.used)).replaceAll('{limit}', _num(t.limit));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('AI usage this month', style: const TextStyle(fontSize: 14)),
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
      appBar: AppBar(title: const Text('Plan & usage')),
      body: status.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Text('Could not load your plan and usage. Please try again.', textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: () => ref.invalidate(subscriptionStatusProvider), child: const Text('Retry')),
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
    String lim(String key) => pending ? 'Pending' : (l.containsKey(key) ? _limit(l[key]!) : '—');
    final t = status.aiTokens;
    final remaining = t.unlimited ? 'Unlimited' : _num(t.remaining);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Current plan', style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 4),
              Text(_planName(status.plan), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              if (status.expired) ...[
                const SizedBox(height: 8),
                Text('Your plan has expired; the free limits apply.', style: const TextStyle(color: Colors.red)),
              ],
              if (status.renewalDate != null && !status.expired) ...[
                const SizedBox(height: 8),
                Text('Plan valid until {date}'.replaceAll('{date}', _date(status.renewalDate!))),
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
              Text('AI usage this month', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              _AiBar(status: status),
              const SizedBox(height: 8),
              if (!pending) _row('Tokens left', remaining),
              if (t.reserved > 0) _row('Reserved by running jobs', _num(t.reserved)),
              if (t.imageTokenEquivalent != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text('One generated image counts as {n} tokens.'.replaceAll('{n}', _num(t.imageTokenEquivalent!)), style: const TextStyle(fontSize: 12, color: Colors.black54)),
                ),
              const SizedBox(height: 4),
              Text('Usage month {period} follows China Standard Time (UTC+8).'.replaceAll('{period}', status.period), style: const TextStyle(fontSize: 12, color: Colors.black54)),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Plan limits', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              _row('Platform accounts', lim('max_accounts')),
              _row('Posts per month', lim('max_publishes_monthly')),
              _row('Team members', l.containsKey('max_members') ? _limit(l['max_members']!) : '—'),
              _row('Storage', l.containsKey('max_storage_gb') ? (l['max_storage_gb'] == -1 ? 'Unlimited' : '${l['max_storage_gb']} GB') : '—'),
              const SizedBox(height: 4),
              Text('Only the plan limits are shown here; posts published so far are not shown on this page yet.', style: const TextStyle(fontSize: 12, color: Colors.black54)),
            ]),
          ),
        ),
      ],
    );
  }
}
