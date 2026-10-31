// ContentFlow Mobile - Models

// ============== Content Pack ==============
class ContentPack {
  final String id;
  final String topic;
  final List<String> titles;
  final List<String> hooks;
  final String script;
  final List<String> hashtags;
  final Map<String, PlatformPayload>? platformPayloads;
  final DateTime createdAt;

  /// What the server reported about this generation (disclosure hint, grounding, compliance counts,
  /// personalisation). Shown as returned; nothing is computed on the device.
  final Map<String, dynamic> serverNotes;

  ContentPack({
    required this.id,
    required this.topic,
    required this.titles,
    required this.hooks,
    required this.script,
    required this.hashtags,
    this.platformPayloads,
    required this.createdAt,
    this.serverNotes = const {},
  });

  factory ContentPack.fromJson(Map<String, dynamic> json) {
    return ContentPack(
      id: json['id'] ?? '',
      topic: json['topic'] ?? '',
      titles: List<String>.from(json['titles'] ?? []),
      hooks: List<String>.from(json['hooks'] ?? []),
      script: json['script'] ?? '',
      hashtags: List<String>.from(json['hashtags'] ?? []),
      platformPayloads: PlatformPayload.mapFromJson(json),
      createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
      serverNotes: {
        for (final key in const [
          'target_market',
          'disclosure_hint',
          'grounding',
          'compliance',
          'positioning_used',
        ])
          if (json[key] != null) key: json[key],
      },
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'topic': topic,
      'titles': titles,
      'hooks': hooks,
      'script': script,
      'hashtags': hashtags,
      'platform_payloads': platformPayloads?.map(
        (k, v) => MapEntry(k, v.toJson()),
      ),
      'created_at': createdAt.toIso8601String(),
    };
  }
}

class PlatformPayload {
  final String platform;
  final String? adaptedTitle;
  final String? adaptedContent;
  final String? coverImage;
  final List<String> hashtags;
  final int? charCount;
  final List<String> notes;

  PlatformPayload({
    required this.platform,
    this.adaptedTitle,
    this.adaptedContent,
    this.coverImage,
    this.hashtags = const [],
    this.charCount,
    this.notes = const [],
  });

  /// Reads the server's per-platform rewrite. The server sends `platform_variants` (a list of
  /// {platform, title, body, hashtags, char_count, notes}); older saved drafts carry `platform_payloads`
  /// (a map keyed by platform). Order is kept.
  static Map<String, PlatformPayload>? mapFromJson(Map<String, dynamic> json) {
    final variants = json['platform_variants'];
    if (variants is List) {
      final out = <String, PlatformPayload>{};
      for (final v in variants) {
        if (v is! Map) continue;
        final m = Map<String, dynamic>.from(v);
        final key = '${m['platform'] ?? ''}';
        if (key.isEmpty) continue;
        out[key] = PlatformPayload.fromJson(m);
      }
      return out;
    }
    final saved = json['platform_payloads'];
    if (saved is Map) {
      return {
        for (final e in saved.entries)
          '${e.key}': PlatformPayload.fromJson(Map<String, dynamic>.from(e.value as Map)),
      };
    }
    return null;
  }

  factory PlatformPayload.fromJson(Map<String, dynamic> json) {
    final tags = json['hashtags'];
    final notes = json['notes'];
    final count = json['char_count'];
    return PlatformPayload(
      platform: json['platform'] ?? '',
      adaptedTitle: json['adapted_title'] ?? (json['title'] is String && (json['title'] as String).isNotEmpty ? json['title'] : null),
      adaptedContent: json['adapted_content'] ?? json['body'],
      coverImage: json['cover_image'],
      hashtags: tags is List ? tags.map((e) => '$e').toList() : const [],
      charCount: count is num ? count.toInt() : null,
      notes: notes is List ? notes.map((e) => '$e').toList() : const [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'platform': platform,
      'adapted_title': adaptedTitle,
      'adapted_content': adaptedContent,
      'cover_image': coverImage,
      'hashtags': hashtags,
      'char_count': charCount,
      'notes': notes,
    };
  }
}

// ============== Schedule ==============
enum ScheduleStatus {
  draft,
  scheduled,
  queued,
  uploading,
  submitting,
  reviewing,
  pending,
  confirmed,
  publishing,
  published,
  failed,
  retrying,
  canceled,
}

class Schedule {
  final String id;
  final String contentPackId;
  final String? title;
  final String platform;
  final DateTime publishTime;
  final ScheduleStatus status;
  final String? errorMessage;

  Schedule({
    required this.id,
    required this.contentPackId,
    this.title,
    required this.platform,
    required this.publishTime,
    required this.status,
    this.errorMessage,
  });

  factory Schedule.fromJson(Map<String, dynamic> json) {
    final content = json['content'] is Map<String, dynamic>
        ? json['content'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final account = json['platform_account'] is Map<String, dynamic>
        ? json['platform_account'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final rawStatus = json['status']?.toString() ?? '';
    final normalizedStatus = switch (rawStatus) {
      'processing' => 'publishing',
      'submitted_unconfirmed' => 'pending',
      'cancelled' => 'canceled',
      _ => rawStatus,
    };
    return Schedule(
      id: json['id'] ?? '',
      contentPackId: json['content_id'] ?? '',
      title: content['title'],
      platform: account['platform'] ?? '',
      publishTime:
          DateTime.tryParse(json['scheduled_at'] ?? '') ?? DateTime.now(),
      status: ScheduleStatus.values.firstWhere(
        (e) => e.name == normalizedStatus,
        orElse: () => ScheduleStatus.pending,
      ),
      errorMessage: json['error_message'],
    );
  }

  String get statusText {
    switch (status) {
      case ScheduleStatus.draft:
        return 'Draft';
      case ScheduleStatus.scheduled:
        return 'Scheduled';
      case ScheduleStatus.queued:
        return 'Queued';
      case ScheduleStatus.uploading:
        return 'Uploading';
      case ScheduleStatus.submitting:
        return 'Submitting';
      case ScheduleStatus.reviewing:
        return 'Reviewing';
      case ScheduleStatus.pending:
        return 'Pending';
      case ScheduleStatus.confirmed:
        return 'Confirmed';
      case ScheduleStatus.publishing:
        return 'Publishing';
      case ScheduleStatus.published:
        return 'Published';
      case ScheduleStatus.failed:
        return 'Failed';
      case ScheduleStatus.retrying:
        return 'Retrying';
      case ScheduleStatus.canceled:
        return 'Canceled';
    }
  }
}

// ============== Asset ==============
enum AssetType { image, video, script }

class Asset {
  final String id;
  final AssetType type;
  final String url;
  final String? thumbnail;
  final String? name;
  final DateTime uploadedAt;

  Asset({
    required this.id,
    required this.type,
    required this.url,
    this.thumbnail,
    this.name,
    required this.uploadedAt,
  });

  factory Asset.fromJson(Map<String, dynamic> json) {
    return Asset(
      id: json['id'] ?? '',
      type: AssetType.values.firstWhere(
        (e) => e.name == json['material_type'],
        orElse: () => AssetType.image,
      ),
      url: json['file_url'] ?? '',
      thumbnail: json['thumbnail'],
      name: json['name'],
      uploadedAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
    );
  }
}

// ============== Analytics ==============
class ContentAnalytics {
  final String contentId;
  final String title;
  final int views;
  final int likes;
  final int comments;
  final int shares;
  final double completionRate;

  ContentAnalytics({
    required this.contentId,
    required this.title,
    required this.views,
    required this.likes,
    required this.comments,
    required this.shares,
    required this.completionRate,
  });

  factory ContentAnalytics.fromJson(Map<String, dynamic> json) {
    return ContentAnalytics(
      contentId: json['content_id'] ?? '',
      title: json['title'] ?? '',
      views: json['views'] ?? 0,
      likes: json['likes'] ?? 0,
      comments: json['comments'] ?? 0,
      shares: json['shares'] ?? 0,
      completionRate: (json['completion_rate'] ?? 0).toDouble(),
    );
  }

  int get totalEngagement => likes + comments + shares;

  double get engagementRate => views > 0 ? totalEngagement / views : 0;
}

class AnalyticsSummary {
  final int totalViews;
  final int totalEngagement;
  final int totalContent;
  final List<ContentAnalytics> topContent;

  AnalyticsSummary({
    required this.totalViews,
    required this.totalEngagement,
    required this.totalContent,
    required this.topContent,
  });

  factory AnalyticsSummary.fromJson(Map<String, dynamic> json) {
    final engagement = json['engagement'] is Map<String, dynamic>
        ? json['engagement'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final content = json['content'] is Map<String, dynamic>
        ? json['content'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return AnalyticsSummary(
      totalViews: engagement['views'] ?? 0,
      totalEngagement:
          (engagement['likes'] ?? 0) +
          (engagement['comments'] ?? 0) +
          (engagement['shares'] ?? 0) +
          (engagement['saves'] ?? 0),
      totalContent: content['total'] ?? 0,
      topContent: const [],
    );
  }
}

// ============== Analytics overview (GET /analytics/overview, own data only) ==============
int _ovInt(dynamic v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;

class PublishCounts {
  final int total;
  final int published;
  final int failed;
  final int inProgress;
  final int manualPending;
  final int manualDone;
  final int cancelled;

  const PublishCounts({
    this.total = 0,
    this.published = 0,
    this.failed = 0,
    this.inProgress = 0,
    this.manualPending = 0,
    this.manualDone = 0,
    this.cancelled = 0,
  });

  factory PublishCounts.fromJson(dynamic json) {
    final m = json is Map ? json : const {};
    return PublishCounts(
      total: _ovInt(m['total']),
      published: _ovInt(m['published']),
      failed: _ovInt(m['failed']),
      inProgress: _ovInt(m['inProgress']),
      manualPending: _ovInt(m['manualPending']),
      manualDone: _ovInt(m['manualDone']),
      cancelled: _ovInt(m['cancelled']),
    );
  }
}

class AiTypeCount {
  final String type;
  final String label;
  final int count;
  const AiTypeCount({required this.type, required this.label, required this.count});
}

class AiCounts {
  final int generations;
  final List<AiTypeCount> byType;
  final int savedAsContent;
  final int approvedOrPublished;

  const AiCounts({
    this.generations = 0,
    this.byType = const [],
    this.savedAsContent = 0,
    this.approvedOrPublished = 0,
  });

  factory AiCounts.fromJson(dynamic json) {
    final m = json is Map ? json : const {};
    final rows = m['byType'] is List ? m['byType'] as List : const [];
    return AiCounts(
      generations: _ovInt(m['generations']),
      byType: [
        for (final r in rows)
          if (r is Map)
            AiTypeCount(type: '${r['type'] ?? ''}', label: '${r['label'] ?? ''}', count: _ovInt(r['count'])),
      ],
      savedAsContent: _ovInt(m['savedAsContent']),
      approvedOrPublished: _ovInt(m['approvedOrPublished']),
    );
  }
}

class OverviewPeriod {
  final PublishCounts publish;
  final AiCounts ai;
  const OverviewPeriod({this.publish = const PublishCounts(), this.ai = const AiCounts()});

  factory OverviewPeriod.fromJson(dynamic json) {
    final m = json is Map ? json : const {};
    return OverviewPeriod(publish: PublishCounts.fromJson(m['publish']), ai: AiCounts.fromJson(m['ai']));
  }
}

class FailureReason {
  final String reason;
  final int count;
  const FailureReason({required this.reason, required this.count});
}

class AnalyticsOverview {
  final OverviewPeriod week;
  final OverviewPeriod month;
  final List<FailureReason> failureReasons;

  /// false until platform authorisation is connected: the server then gives no engagement numbers at all.
  final bool engagementAvailable;
  final String engagementMessage;
  final String engagementDetail;

  const AnalyticsOverview({
    this.week = const OverviewPeriod(),
    this.month = const OverviewPeriod(),
    this.failureReasons = const [],
    this.engagementAvailable = false,
    this.engagementMessage = '',
    this.engagementDetail = '',
  });

  factory AnalyticsOverview.fromJson(Map<String, dynamic> json) {
    final eng = json['engagement'] is Map ? json['engagement'] as Map : const {};
    final reasons = json['failureReasons'] is List ? json['failureReasons'] as List : const [];
    return AnalyticsOverview(
      week: OverviewPeriod.fromJson(json['week']),
      month: OverviewPeriod.fromJson(json['month']),
      failureReasons: [
        for (final r in reasons)
          if (r is Map) FailureReason(reason: '${r['reason'] ?? ''}', count: _ovInt(r['count'])),
      ],
      engagementAvailable: eng['available'] == true,
      engagementMessage: '${eng['message'] ?? ''}',
      engagementDetail: '${eng['detail'] ?? ''}',
    );
  }
}

// ============== User ==============
class User {
  final String id;
  final String name;
  final String? avatar;
  final String plan; // free, pro, enterprise
  final int apiUsage;
  final int apiLimit;
  final int storageUsage;
  final int storageLimit;

  User({
    required this.id,
    required this.name,
    this.avatar,
    required this.plan,
    required this.apiUsage,
    required this.apiLimit,
    required this.storageUsage,
    required this.storageLimit,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      avatar: json['avatar'],
      plan: json['plan'] ?? 'free',
      apiUsage: json['api_usage'] ?? 0,
      apiLimit: json['api_limit'] ?? 1000,
      storageUsage: json['storage_usage'] ?? 0,
      storageLimit: json['storage_limit'] ?? 500,
    );
  }

  String get planText {
    switch (plan) {
      case 'pro':
        return 'Pro';
      case 'enterprise':
        return 'Enterprise';
      default:
        return 'Free';
    }
  }
}

/// A saved content (what "Save to content pack" creates). Only the fields the Assets tab needs.
class ContentDraft {
  final String id;
  final String title;
  final String body;
  final String source;
  final String status;
  final DateTime createdAt;

  ContentDraft({
    required this.id,
    required this.title,
    required this.body,
    required this.source,
    required this.status,
    required this.createdAt,
  });

  factory ContentDraft.fromJson(Map<String, dynamic> json) {
    return ContentDraft(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      body: (json['body'] ?? '').toString(),
      source: (json['source'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()) ?? DateTime.now(),
    );
  }
}
