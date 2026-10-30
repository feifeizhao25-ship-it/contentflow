import '../../core/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/providers.dart';
import '../../data/models.dart';
import '../../core/error_text.dart';

class AssetsScreen extends ConsumerWidget {
  const AssetsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assetsAsync = ref.watch(assetsProvider);
    final selectedType = ref.watch(selectedAssetTypeProvider);

    return Scaffold(
            body: SafeArea(
        child: Column(
          children: [
            // Header
            _buildHeader(context, ref),

            // Filter Tabs
            _buildFilterTabs(context, ref, selectedType),

            // Assets Grid
            Expanded(
              child: assetsAsync.when(
                data: (assets) => _buildAssetsGrid(context, assets),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text(friendlyError(e))),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showUploadDialog(context, ref),
        backgroundColor: Theme.of(context).primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          const Text('📁', style: TextStyle(fontSize: 28)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '素材库',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).primaryColor,
                  ),
                ),
                const Text(
                  '管理你的素材资源',
                  style: TextStyle(fontSize: 14, color: Colors.grey),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => _showUploadDialog(context, ref),
            icon: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Theme.of(context).primaryColor,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.upload, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTabs(
    BuildContext context,
    WidgetRef ref,
    AssetType? selectedType,
  ) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildFilterChip(context, ref, null, '全部', selectedType),
            const SizedBox(width: 8),
            _buildFilterChip(context, ref, AssetType.image, '图片', selectedType),
            const SizedBox(width: 8),
            _buildFilterChip(context, ref, AssetType.video, '视频', selectedType),
            const SizedBox(width: 8),
            _buildFilterChip(
              context,
              ref,
              AssetType.script,
              '脚本',
              selectedType,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(
    BuildContext context,
    WidgetRef ref,
    AssetType? type,
    String label,
    AssetType? selectedType,
  ) {
    final isSelected = selectedType == type;

    return FilterChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) {
        ref.read(selectedAssetTypeProvider.notifier).state = type;
        ref.invalidate(assetsProvider);
      },
      selectedColor: Theme.of(context).primaryColor.withValues(alpha: 0.2),
      checkmarkColor: Theme.of(context).primaryColor,
    );
  }

  Widget _buildAssetsGrid(BuildContext context, List<Asset> assets) {
    if (assets.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.folder_open, size: 64, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              '暂无素材',
              style: TextStyle(fontSize: 16, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 8),
            Text(
              '点击 + 上传素材',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade400),
            ),
          ],
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(20),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: assets.length,
      itemBuilder: (context, index) => _buildAssetCard(context, assets[index]),
    );
  }

  Widget _buildAssetCard(BuildContext context, Asset asset) {
    return GestureDetector(
      onTap: () => _showAssetDetail(context, asset),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: AppColors.card(context),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Column(
            children: [
              Expanded(child: _buildAssetPreview(context, asset)),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    _buildAssetTypeIcon(asset.type),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        asset.name ?? _getAssetTypeName(asset.type),
                        style: const TextStyle(fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAssetPreview(BuildContext context, Asset asset) {
    switch (asset.type) {
      case AssetType.image:
        return Image.network(
          asset.thumbnail ?? asset.url,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: const Icon(Icons.image, color: Colors.grey),
          ),
        );
      case AssetType.video:
        return Stack(
          fit: StackFit.expand,
          children: [
            asset.thumbnail != null
                ? Image.network(
                    asset.thumbnail!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        Container(color: Theme.of(context).colorScheme.surfaceContainerHighest),
                  )
                : Container(color: Theme.of(context).colorScheme.surfaceContainerHighest),
            Center(
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.play_arrow,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ),
          ],
        );
      case AssetType.script:
        return Container(
          color: Colors.blue.shade50,
          child: const Center(
            child: Icon(Icons.description, color: Colors.blue, size: 32),
          ),
        );
    }
  }

  Widget _buildAssetTypeIcon(AssetType type) {
    IconData icon;
    Color color;

    switch (type) {
      case AssetType.image:
        icon = Icons.image;
        color = Colors.green;
        break;
      case AssetType.video:
        icon = Icons.videocam;
        color = Colors.red;
        break;
      case AssetType.script:
        icon = Icons.description;
        color = Colors.blue;
        break;
    }

    return Icon(icon, size: 14, color: color);
  }

  String _getAssetTypeName(AssetType type) {
    switch (type) {
      case AssetType.image:
        return '图片';
      case AssetType.video:
        return '视频';
      case AssetType.script:
        return '脚本';
    }
  }

  void _showAssetDetail(BuildContext context, Asset asset) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _buildAssetTypeIcon(asset.type),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    asset.name ?? '素材',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 20),
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: _buildAssetPreview(context, asset),
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  void _showUploadDialog(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              '上传素材',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.photo_library, color: Colors.green),
              ),
              title: const Text('从相册选择'),
              subtitle: const Text('选择图片或视频'),
              onTap: () => _pickImage(context, ref, ImageSource.gallery),
            ),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.camera_alt, color: Colors.red),
              ),
              title: const Text('拍摄'),
              subtitle: const Text('使用相机拍摄'),
              onTap: () => _pickImage(context, ref, ImageSource.camera),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Future<void> _pickImage(
    BuildContext context,
    WidgetRef ref,
    ImageSource source,
  ) async {
    final picker = ImagePicker();

    try {
      final XFile? image = await picker.pickImage(source: source);

      if (image != null) {
        if (!context.mounted) return;
        // Upload
        final api = ref.read(apiClientProvider);

        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('上传中...')));

        AssetType type = source == ImageSource.camera
            ? AssetType.image
            : AssetType.image;
        await api.uploadAsset(image.path, type);

        ref.invalidate(assetsProvider);

        if (context.mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('上传成功')));
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(friendlyError(e, fallback: '上传失败，请稍后重试'))));
      }
    }
  }
}
