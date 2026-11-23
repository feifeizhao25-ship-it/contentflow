/// 本机图片的前置检查。上传尚未开通，检查通过也不代表文件已经上传。
const int localImageMaxBytes = 10 * 1024 * 1024;

const Set<String> localImageExtensions = {'jpg', 'jpeg', 'png', 'webp', 'gif'};

const String assetPickTitle = '选择本地图片';
const String assetPickNotice = '目前只能从本机选择图片。不能选择视频。上传尚未开通，文件不会传到服务器，也不会显示上传成功。';
const String assetGalleryTitle = '从相册选择图片';
const String assetGallerySubtitle = '仅 JPG、JPEG、PNG、WEBP、GIF，单张不超过 10MB';
const String assetCameraTitle = '拍摄图片';
const String assetCameraSubtitle = '只拍图片。上传尚未开通';
const String assetEmptyMessage = '素材上传尚未开通。可以查看已有图片、视频或脚本；从本机选图只会做格式和大小检查，不会上传。';

class LocalImageCheck {
  final bool ok;
  final String message;

  const LocalImageCheck({required this.ok, required this.message});
}

String imageExtension(String name) {
  final trimmed = name.trim();
  final dot = trimmed.lastIndexOf('.');
  if (dot < 0 || dot == trimmed.length - 1) return '';
  return trimmed.substring(dot + 1).toLowerCase();
}

/// 格式或大小不合格时返回原因。合格时说明文件仍在本机、没有上传。
LocalImageCheck checkLocalImage({required String name, required int sizeBytes}) {
  final ext = imageExtension(name);
  if (!localImageExtensions.contains(ext)) {
    return const LocalImageCheck(
      ok: false,
      message: '只支持 JPG、JPEG、PNG、WEBP、GIF 图片。视频不能选，这一张没有上传。',
    );
  }
  if (sizeBytes <= 0) {
    return const LocalImageCheck(ok: false, message: '没有读到图片大小，请换一张图片。这一张没有上传。');
  }
  if (sizeBytes > localImageMaxBytes) {
    return const LocalImageCheck(ok: false, message: '图片需小于 10MB。这一张没有上传。');
  }
  return const LocalImageCheck(
    ok: true,
    message: '图片格式和大小符合要求。素材上传尚未开通，文件只留在本机，没有上传到服务器。',
  );
}
