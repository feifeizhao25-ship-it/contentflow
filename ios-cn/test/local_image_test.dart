import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_cn/data/api_client.dart';
import 'package:contentflow_cn/data/models.dart';
import 'package:contentflow_cn/data/token_storage.dart';
import 'package:contentflow_cn/features/assets/local_image.dart';

class _MemoryStore implements SecretStore {
  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

void main() {
  test('rejects video-like names and oversized files before any upload', () {
    expect(checkLocalImage(name: 'clip.mp4', sizeBytes: 100).ok, isFalse);
    expect(checkLocalImage(name: 'clip.mp4', sizeBytes: 100).message, contains('没有上传'));
    expect(checkLocalImage(name: 'photo.JPG', sizeBytes: localImageMaxBytes + 1).message, contains('10MB'));
    expect(checkLocalImage(name: 'photo.png', sizeBytes: 0).ok, isFalse);
  });

  test('a valid local image is not described as uploaded', () {
    final check = checkLocalImage(name: 'cover.webp', sizeBytes: 2048);
    expect(check.ok, isTrue);
    expect(check.message, contains('尚未开通'));
    expect(check.message, isNot(contains('上传成功')));
  });

  test('upload stays closed and does not pretend success', () {
    final client = ApiClient(TokenStorage(store: _MemoryStore()), baseUrl: 'https://example.com/api/v1');
    expect(client.assetUploadEnabled, isFalse);
    expect(
      client.uploadAsset('/tmp/a.png', AssetType.image),
      throwsA(isA<UnsupportedError>().having((error) => '$error', 'message', contains('尚未开通'))),
    );
  });
}
