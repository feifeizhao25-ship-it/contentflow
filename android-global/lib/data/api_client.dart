import 'package:dio/dio.dart';
import '../config/global_config.dart';
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
      if (data is Map<String, dynamic> && data['items'] is List) {
        return data['items'] as List;
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
    return _handle(
      () => _dio.post('/content-pack/save', data: pack.toJson()),
      (payload) => ContentPack.fromJson(_extractMap(payload)),
    );
  }

  Future<List<ContentPack>> getContentPacks() async {
    return _handle(
      () => _dio.get('/content-pack/list'),
      (payload) => _extractList(
        payload,
      ).map((e) => ContentPack.fromJson(Map<String, dynamic>.from(e))).toList(),
    );
  }

  // ============== Schedule ==============

  Future<List<Schedule>> getTodaySchedules() async {
    return _handle(
      () => _dio.get('/schedule/today'),
      (payload) => _extractList(
        payload,
      ).map((e) => Schedule.fromJson(Map<String, dynamic>.from(e))).toList(),
    );
  }

  Future<bool> confirmPublish(String scheduleId) async {
    return _handle(
      () => _dio.post('/publish/confirm', data: {'schedule_id': scheduleId}),
      (_) => true,
    );
  }

  Future<bool> retryPublish(String scheduleId) async {
    return _handle(
      () => _dio.post('/publish/retry', data: {'schedule_id': scheduleId}),
      (_) => true,
    );
  }

  // ============== Assets ==============

  Future<List<Asset>> getAssets({AssetType? type}) async {
    return _handle(
      () => _dio.get(
        '/assets/list',
        queryParameters: type != null ? {'type': type.name} : null,
      ),
      (payload) => _extractList(
        payload,
      ).map((e) => Asset.fromJson(Map<String, dynamic>.from(e))).toList(),
    );
  }

  Future<Asset> uploadAsset(String filePath, AssetType type) async {
    return _handle(() async {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath),
        'type': type.name,
      });
      return _dio.post('/assets/upload', data: formData);
    }, (payload) => Asset.fromJson(_extractMap(payload)));
  }

  // ============== Analytics ==============

  Future<AnalyticsSummary> getAnalyticsSummary() async {
    return _handle(
      () => _dio.get('/analytics/summary'),
      (payload) => AnalyticsSummary.fromJson(_extractMap(payload)),
    );
  }

  Future<List<ContentAnalytics>> getContentAnalytics() async {
    return _handle(
      () => _dio.get('/analytics/content'),
      (payload) => _extractList(payload)
          .map((e) => ContentAnalytics.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }

  // ============== User ==============

  Future<User> getUser() async {
    return _handle(
      () => _dio.get('/user/me'),
      (payload) => User.fromJson(_extractMap(payload)),
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
      throw ApiException('Login failed: token missing');
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
