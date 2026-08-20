import 'package:dio/dio.dart';
import '../config/cn_config.dart';
import 'api_exception.dart';
import 'models.dart';
import 'token_storage.dart';

class ApiClient {
  final Dio _dio;
  final TokenStorage _tokenStorage;

  ApiClient(this._tokenStorage)
    : _dio = Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
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
  }) async {
    return _handle(
      () => _dio.post(
        '/content-pack/generate',
        data: {'topic': topic, 'count': titleCount},
      ),
      (payload) => ContentPack.fromJson(_extractMap(payload)),
    );
  }

  Future<ContentPack> saveContentPack(ContentPack pack) async {
    throw UnsupportedError('内容包保存接口尚未开放');
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
