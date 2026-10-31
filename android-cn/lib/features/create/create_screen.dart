import '../../core/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../data/models.dart';
import 'platform_options.dart';
import '../../core/error_text.dart';

class CreateScreen extends ConsumerStatefulWidget {
  const CreateScreen({super.key});

  @override
  ConsumerState<CreateScreen> createState() => _CreateScreenState();
}

class _CreateScreenState extends ConsumerState<CreateScreen> {
  final _topicController = TextEditingController();
  bool _isGenerating = false;
  ContentPack? _generatedPack;
  final Set<String> _platforms = {...kDefaultPlatforms};
  bool _saving = false;
  bool _saved = false;

  @override
  void dispose() {
    _topicController.dispose();
    super.dispose();
  }

  /// 生成失败时的原因，常驻屏幕（不只是一闪而过的提示条）。
  String? _errorMessage;

  Future<void> _generateContentPack() async {
    if (_topicController.text.trim().isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('请输入主题')));
      return;
    }

    setState(() {
      _isGenerating = true;
      _errorMessage = null;
    });

    try {
      final api = ref.read(apiClientProvider);
      final pack = await api.generateContentPack(
        topic: _topicController.text.trim(),
        platforms: _platforms.toList(),
      );
      setState(() {
        _generatedPack = pack;
        _saved = false;
      });
    } catch (e) {
      final message = friendlyError(e, fallback: '生成失败，请稍后重试');
      if (mounted) {
        setState(() => _errorMessage = message);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(message)));
      }
    } finally {
      if (mounted) {
        setState(() {
          _isGenerating = false;
        });
      }
    }
  }

  Future<void> _saveGeneratedPack() async {
    final pack = _generatedPack;
    if (pack == null || _saving || _saved) return;
    setState(() => _saving = true);
    try {
      await ref.read(apiClientProvider).saveContentPack(pack);
      if (mounted) {
        setState(() => _saved = true);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('已保存为云端草稿')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(friendlyError(error, fallback: '保存失败，请稍后重试'))));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showPlatformAdapters(ContentPack pack) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => PlatformAdapterSheet(
        payloads: pack.platformPayloads ?? const <String, PlatformPayload>{},
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
            body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // Header
            SliverToBoxAdapter(child: _buildHeader(context)),

            // Input Section
            SliverToBoxAdapter(child: _buildInputSection(context)),

            // Generated Content
            if (_generatedPack != null) ...[
              SliverToBoxAdapter(child: _buildGeneratedContent(context)),
            ],

            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          const Text('✨', style: TextStyle(fontSize: 28)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '快速创作',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).primaryColor,
                  ),
                ),
                const Text(
                  'AI 帮你生成内容',
                  style: TextStyle(fontSize: 14, color: Colors.grey),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputSection(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.card(context),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '输入主题',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _topicController,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: '例如: Python入门教程',
              hintStyle: const TextStyle(color: Colors.grey),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(
                  color: Theme.of(context).primaryColor,
                  width: 2,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          PlatformPicker(
            selected: _platforms,
            onChanged: (v) => setState(() {
              _platforms
                ..clear()
                ..addAll(v);
            }),
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 16),
            Container(
              key: const Key('create_error_banner'),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('生成失败',
                            style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.red.shade900)),
                        const SizedBox(height: 2),
                        Text(_errorMessage!,
                            style: TextStyle(color: Colors.red.shade900)),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: _isGenerating ? null : _generateContentPack,
                    child: const Text('重试'),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _isGenerating ? null : _generateContentPack,
              style: ElevatedButton.styleFrom(
                backgroundColor: Theme.of(context).primaryColor,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _isGenerating
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Text(
                      '生成内容包',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGeneratedContent(BuildContext context) {
    final pack = _generatedPack!;

    return Container(
      margin: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Titles
          _buildContentCard(
            context,
            '📝 生成的标题',
            Column(
              children: pack.titles.asMap().entries.map((entry) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: Theme.of(
                            context,
                          ).primaryColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Center(
                          child: Text(
                            '${entry.key + 1}',
                            style: TextStyle(
                              color: Theme.of(context).primaryColor,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Text(entry.value)),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 16),

          // Hooks
          _buildContentCard(
            context,
            '🎣 钩子',
            Column(
              children: pack.hooks.map((hook) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      const Icon(Icons.bolt, color: Colors.orange, size: 18),
                      const SizedBox(width: 8),
                      Expanded(child: Text(hook)),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 16),

          // Script
          _buildContentCard(
            context,
            '📜 脚本',
            Text(pack.script, style: const TextStyle(height: 1.6)),
          ),

          const SizedBox(height: 16),

          // Hashtags
          _buildContentCard(
            context,
            '#️⃣ 标签',
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: pack.hashtags.map((tag) {
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Theme.of(
                      context,
                    ).primaryColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    tag,
                    style: TextStyle(color: Theme.of(context).primaryColor),
                  ),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 24),

          // Action Buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: (_saving || _saved) ? null : _saveGeneratedPack,
                  icon: Icon(_saved ? Icons.check : Icons.save),
                  label: Text(_saved ? '已保存' : '保存到内容包'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: BorderSide(color: Theme.of(context).primaryColor),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _showPlatformAdapters(pack),
                  icon: const Icon(Icons.adjust),
                  label: const Text('平台适配'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildContentCard(BuildContext context, String title, Widget content) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          content,
        ],
      ),
    );
  }
}
