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

  ContentPack({
    required this.id,
    required this.topic,
    required this.titles,
    required this.hooks,
    required this.script,
    required this.hashtags,
    this.platformPayloads,
    required this.createdAt,
  });

  factory ContentPack.fromJson(Map<String, dynamic> json) {
    return ContentPack(
      id: json['id'] ?? '',
      topic: json['topic'] ?? '',
      titles: List<String>.from(json['titles'] ?? []),
      hooks: List<String>.from(json['hooks'] ?? []),
      script: json['script'] ?? '',
      hashtags: List<String>.from(json['hashtags'] ?? []),
      platformPayloads: json['platform_payloads'] != null
          ? Map<String, PlatformPayload>.from(json['platform_payloads'].map(
              (k, v) => MapEntry(k, PlatformPayload.fromJson(v)),
            ))
          : null,
      createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
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
      'platform_payloads': platformPayloads?.map((k, v) => MapEntry(k, v.toJson())),
      'created_at': createdAt.toIso8601String(),
    };
  }
}

class PlatformPayload {
  final String platform;
  final String? adaptedTitle;
  final String? adaptedContent;
  final String? coverImage;

  PlatformPayload({
    required this.platform,
    this.adaptedTitle,
    this.adaptedContent,
    this.coverImage,
  });

  factory PlatformPayload.fromJson(Map<String, dynamic> json) {
    return PlatformPayload(
      platform: json['platform'] ?? '',
      adaptedTitle: json['adapted_title'],
      adaptedContent: json['adapted_content'],
      coverImage: json['cover_image'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'platform': platform,
      'adapted_title': adaptedTitle,
      'adapted_content': adaptedContent,
      'cover_image': coverImage,
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
    return Schedule(
      id: json['id'] ?? '',
      contentPackId: json['content_pack_id'] ?? '',
      title: json['title'],
      platform: json['platform'] ?? '',
      publishTime: DateTime.tryParse(json['publish_time'] ?? '') ?? DateTime.now(),
      status: ScheduleStatus.values.firstWhere(
        (e) => e.name == json['status'],
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
enum AssetType {
  image,
  video,
  script,
}

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
        (e) => e.name == json['type'],
        orElse: () => AssetType.image,
      ),
      url: json['url'] ?? '',
      thumbnail: json['thumbnail'],
      name: json['name'],
      uploadedAt: DateTime.tryParse(json['uploaded_at'] ?? '') ?? DateTime.now(),
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
    return AnalyticsSummary(
      totalViews: json['total_views'] ?? 0,
      totalEngagement: json['total_engagement'] ?? 0,
      totalContent: json['total_content'] ?? 0,
      topContent: (json['top_content'] as List?)
              ?.map((e) => ContentAnalytics.fromJson(e))
              .toList() ??
          [],
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
