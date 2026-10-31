/// 当前租户的订阅与用量，来自 GET /billing/subscription（服务端是唯一来源；这里不做任何推算）。
class AiTokenUsage {
  final int limit;
  final int used;
  final int reserved;
  final int remaining;
  final bool unlimited;
  final int? imageTokenEquivalent;

  const AiTokenUsage({
    required this.limit,
    required this.used,
    required this.reserved,
    required this.remaining,
    required this.unlimited,
    this.imageTokenEquivalent,
  });

  factory AiTokenUsage.fromJson(Map<String, dynamic> json) {
    int n(dynamic v) => v is num ? v.toInt() : 0;
    return AiTokenUsage(
      limit: n(json['limit']),
      used: n(json['used']),
      reserved: n(json['reserved']),
      remaining: n(json['remaining']),
      unlimited: json['unlimited'] == true || n(json['limit']) == -1,
      imageTokenEquivalent: json['imageTokenEquivalent'] is num
          ? (json['imageTokenEquivalent'] as num).toInt()
          : null,
    );
  }

  /// 0..1; null when there is no finite limit to compare against.
  double? get fraction {
    if (unlimited || limit <= 0) return null;
    return (used / limit).clamp(0.0, 1.0).toDouble();
  }
}

class SubscriptionStatus {
  final String plan;
  final bool quotaUnconfirmed;
  final AiTokenUsage aiTokens;
  final DateTime? renewalDate;
  final String? renewalNotice;
  final bool expired;
  final Map<String, int> limits;
  final String period;

  const SubscriptionStatus({
    required this.plan,
    required this.quotaUnconfirmed,
    required this.aiTokens,
    required this.renewalDate,
    required this.renewalNotice,
    required this.expired,
    required this.limits,
    required this.period,
  });

  factory SubscriptionStatus.fromJson(Map<String, dynamic> json) {
    final tokens = json['aiTokens'];
    final limits = <String, int>{};
    final rawLimits = json['limits'];
    if (rawLimits is Map) {
      rawLimits.forEach((key, value) {
        if (value is num) limits['$key'] = value.toInt();
      });
    }
    return SubscriptionStatus(
      plan: '${json['plan'] ?? 'free'}',
      quotaUnconfirmed: json['quotaStatus'] == 'unconfirmed',
      aiTokens: AiTokenUsage.fromJson(
        tokens is Map ? Map<String, dynamic>.from(tokens) : const {},
      ),
      renewalDate: json['renewalDate'] is String
          ? DateTime.tryParse(json['renewalDate'] as String)?.toLocal()
          : null,
      renewalNotice:
          json['renewalNotice'] is String &&
              (json['renewalNotice'] as String).isNotEmpty
          ? json['renewalNotice'] as String
          : null,
      expired: json['expired'] == true,
      limits: limits,
      period: '${json['period'] ?? ''}',
    );
  }
}
