import 'package:dio/dio.dart';
import '../config/cn_config.dart';
import 'api_exception.dart';
import 'models.dart';
import 'subscription_status.dart';
import 'token_storage.dart';

/// The pack is built from several sequential model calls, so this one request may legitimately
/// take longer than the 30 s default used everywhere else.
const Duration kGenerateTimeout = Duration(seconds: 150);

class ApiClient {
  final Dio _dio;
  final TokenStorage _tokenStorage;

  /// [baseUrl] is for tests that build a fake client; the app always uses the validated AppConfig value.
  ApiClient(this._tokenStorage, {String? baseUrl})
    : _dio = Dio(
        BaseOptions(
          baseUrl: baseUrl ?? AppConfig.apiBaseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 30),
          headers: {'Content-Type': 'application/json', 'X-Client': 'mobile'},
        ),
      ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStorage.readToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (error, handler) {
          return handler.next(error);
        },
      ),
    );
  }

  Future<T> _handle<T>(
    Future<Response<dynamic>> Function() request,
    T Function(dynamic payload) parser,
  ) async {
    try {
      final response = await request();
      return parser(response.data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Map<String, dynamic> _extractMap(dynamic payload) {
    if (payload is Map<String, dynamic>) {
      final data = payload['data'];
      if (data is Map<String, dynamic>) {
        return data;
      }
      return payload;
    }
    return <String, dynamic>{};
  }

  List<dynamic> _extractList(dynamic payload) {
    if (payload is List) return payload;
    if (payload is Map<String, dynamic>) {
      final data = payload['data'];
      if (data is List) return data;
      if (data is Map<String, dynamic>) {
        for (final key in const ['items', 'tasks', 'contents', 'members']) {
          if (data[key] is List) return data[key] as List;
        }
      }
      if (payload['items'] is List) return payload['items'] as List;
    }
    return const [];
  }

  // ============== Content Pack ==============

  Future<ContentPack> generateContentPack({
    required String topic,
    int titleCount = 5,
    List<String>? platforms,
  }) async {
    return _handle(
      () => _dio.post(
        '/content-pack/generate',
        options: Options(receiveTimeout: kGenerateTimeout),
        data: {
          'topic': topic,
          'count': titleCount,
          if (platforms != null && platforms.isNotEmpty) 'platforms': platforms,
        },
      ),
      (payload) {
        // 服务端对结果包了两层（{data: {success, data: {...}}}），这里取最里面那层。
        final outer = _extractMap(payload);
        final inner = outer['data'];
        return ContentPack.fromJson(inner is Map<String, dynamic> ? inner : outer);
      },
    );
  }

  /// The server keeps titles to 200 characters.
  static String _draftTitle(ContentPack pack) {
    final t = (pack.titles.isNotEmpty ? pack.titles.first : pack.topic).trim();
    return t.length > 200 ? t.substring(0, 200) : t;
  }

  Future<ContentPack> saveContentPack(ContentPack pack) async {
    await _handle(
      () => _dio.post(
        '/contents',
        data: {
          'title': _draftTitle(pack),
          'body': pack.script,
          'content_type': 'script',
          'tags': pack.hashtags,
          'source': 'ai',
          'ai_params': pack.toJson(),
        },
      ),
      (payload) => _extractMap(payload),
    );
    return pack;
  }

  Future<List<ContentPack>> getContentPacks() async {
    throw UnsupportedError('内容包列表接口尚未开放');
  }

  // ============== Schedule ==============

  Future<List<Schedule>> getTodaySchedules() async {
    return _handle(
      () => _dio.get('/publish/tasks', queryParameters: {'pageSize': 50}),
      (payload) => _extractList(
        payload,
      ).map((e) => Schedule.fromJson(Map<String, dynamic>.from(e))).toList(),
    );
  }

  Future<bool> confirmPublish(String scheduleId) async {
    throw UnsupportedError('发布结果必须由平台回执确认，不能由客户端手动确认');
  }

  Future<bool> retryPublish(String scheduleId) async {
    return _handle(
      () => _dio.post('/publish/tasks/$scheduleId/retry'),
      (payload) => _extractMap(payload).isNotEmpty,
    );
  }

  // ============== Assets ==============

  Future<List<Asset>> getAssets({AssetType? type}) async {
    return _handle(
      () => _dio.get(
        '/materials',
        queryParameters: type != null ? {'type': type.name} : null,
      ),
      (payload) => _extractList(
        payload,
      ).map((e) => Asset.fromJson(Map<String, dynamic>.from(e))).toList(),
    );
  }

  /// Saved content-pack drafts, newest first.
  Future<List<ContentDraft>> getContentDrafts() async {
    return _handle(
      () => _dio.get(
        '/contents',
        queryParameters: {'status': 'draft', 'page': 1, 'pageSize': 50},
      ),
      (payload) => _extractList(
        payload,
      ).map((e) => ContentDraft.fromJson(Map<String, dynamic>.from(e))).toList(),
    );
  }

  Future<Asset> uploadAsset(String filePath, AssetType type) async {
    throw UnsupportedError('素材上传将在对象存储签名上传接入后开放');
  }

  // ============== Analytics ==============

  Future<AnalyticsSummary> getAnalyticsSummary() async {
    return _handle(
      () => _dio.get('/analytics/dashboard'),
      (payload) => AnalyticsSummary.fromJson(_extractMap(payload)),
    );
  }

  Future<List<ContentAnalytics>> getContentAnalytics() async {
    return _handle(
      () => _dio.get('/analytics/dashboard'),
      (_) => <ContentAnalytics>[],
    );
  }

  // ============== Subscription ==============

  /// 套餐与本月用量：服务端 GET /billing/subscription 是唯一来源。
  Future<SubscriptionStatus> getSubscriptionStatus() async {
    return _handle(
      () => _dio.get('/billing/subscription'),
      (payload) => SubscriptionStatus.fromJson(_extractMap(payload)),
    );
  }

  // ============== User ==============

  Future<User> getUser() async {
    return _handle(
      () => _dio.get('/users/me'),
      (payload) => User.fromJson(
        Map<String, dynamic>.from(
          _extractMap(payload)['user'] ?? _extractMap(payload),
        ),
      ),
    );
  }

  /// 注销账号：调用后端已有的 POST /users/me/delete-account（不可恢复）。
  /// 有密码的账号必须再输一次密码；手机号注册（无密码）的账号由后端判断。
  Future<void> deleteAccount({String? password}) async {
    await _handle(
      () => _dio.post(
        '/users/me/delete-account',
        data: {
          'confirm': true,
          if (password != null && password.isNotEmpty) 'password': password,
        },
      ),
      (data) => data,
    );
    await clearToken();
  }

  Future<void> persistToken(String token) {
    return _tokenStorage.writeToken(token);
  }

  Future<void> clearToken() {
    return _tokenStorage.clearToken();
  }

  Future<void> login({
    required String email,
    required String password,
    String? tenantSlug,
  }) async {
    final payload = await _handle(
      () => _dio.post(
        '/auth/login',
        data: {
          'email': email,
          'password': password,
          if (tenantSlug != null && tenantSlug.isNotEmpty)
            'tenant_slug': tenantSlug,
        },
      ),
      (data) => data,
    );

    final token = _extractToken(payload);
    if (token == null || token.isEmpty) {
      throw ApiException('登录失败，未返回令牌');
    }
    await persistToken(token);
  }

  String? _extractToken(dynamic payload) {
    if (payload is Map<String, dynamic>) {
      final data = payload['data'];
      if (data is Map<String, dynamic>) {
        return data['token'] ?? data['access_token'] ?? data['jwt'];
      }
      return payload['token'] ?? payload['access_token'] ?? payload['jwt'];
    }
    return null;
  }
}
