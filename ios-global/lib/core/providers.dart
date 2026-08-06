import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/api_client.dart';
import '../data/models.dart';
import '../data/token_storage.dart';

// ============== API Client Provider ==============
final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return TokenStorage();
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.read(tokenStorageProvider));
});

// ============== Auth State ==============
final authStateProvider = FutureProvider<bool>((ref) async {
  final token = await ref.read(tokenStorageProvider).readToken();
  return token != null && token.isNotEmpty;
});

// ============== Today Providers ==============
final todaySchedulesProvider = FutureProvider<List<Schedule>>((ref) async {
  final api = ref.read(apiClientProvider);
  return api.getTodaySchedules();
});

final confirmPublishProvider = FutureProvider.family<bool, String>((
  ref,
  scheduleId,
) async {
  final api = ref.read(apiClientProvider);
  return api.confirmPublish(scheduleId);
});

final retryPublishProvider = FutureProvider.family<bool, String>((
  ref,
  scheduleId,
) async {
  final api = ref.read(apiClientProvider);
  return api.retryPublish(scheduleId);
});

// ============== Create Providers ==============
final contentPackTopicProvider = StateProvider<String>((ref) => '');

final generatedContentPackProvider = StateProvider<ContentPack?>((ref) => null);

final generateContentPackProvider = FutureProvider.family<ContentPack, String>((
  ref,
  topic,
) async {
  final api = ref.read(apiClientProvider);
  return api.generateContentPack(topic: topic);
});

// ============== Assets Providers ==============
final selectedAssetTypeProvider = StateProvider<AssetType?>((ref) => null);

final assetsProvider = FutureProvider<List<Asset>>((ref) async {
  final api = ref.read(apiClientProvider);
  final selectedType = ref.watch(selectedAssetTypeProvider);
  return api.getAssets(type: selectedType);
});

// ============== Analytics Providers ==============
final analyticsSummaryProvider = FutureProvider<AnalyticsSummary>((ref) async {
  final api = ref.read(apiClientProvider);
  return api.getAnalyticsSummary();
});

final contentAnalyticsProvider = FutureProvider<List<ContentAnalytics>>((
  ref,
) async {
  final api = ref.read(apiClientProvider);
  return api.getContentAnalytics();
});

// ============== User Providers ==============
final userProvider = FutureProvider<User>((ref) async {
  final api = ref.read(apiClientProvider);
  return api.getUser();
});

// ============== Navigation ==============
final currentTabProvider = StateProvider<int>((ref) => 0);
