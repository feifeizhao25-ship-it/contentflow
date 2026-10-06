import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../data/models.dart';
import '../../core/error_text.dart';
import 'package:flutter/services.dart';
import '../../config/cn_config.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(userProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: SafeArea(
        child: userAsync.when(
          data: (user) => _buildContent(context, ref, user),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text(friendlyError(e))),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, WidgetRef ref, User user) {
    return CustomScrollView(
      slivers: [
        // Header
        SliverToBoxAdapter(child: _buildHeader(context, user)),

        // Upgrade Banner
        if (user.plan == 'free')
          SliverToBoxAdapter(child: _buildUpgradeBanner(context)),

        // Usage
        SliverToBoxAdapter(child: _buildUsageSection(context, user)),

        // Menu Items
        SliverToBoxAdapter(child: _buildSectionTitle('功能')),
        SliverToBoxAdapter(
          child: _buildMenuItem(context, Icons.people, '团队管理', '管理团队成员'),
        ),
        SliverToBoxAdapter(
          child: _buildMenuItem(context, Icons.key, 'API 配置', '管理 API 密钥'),
        ),

        SliverToBoxAdapter(child: _buildSectionTitle('设置')),
        SliverToBoxAdapter(
          child: _buildMenuItem(context, Icons.settings, '应用设置', ''),
        ),
        SliverToBoxAdapter(
          child: _buildMenuItem(context, Icons.help_outline, '帮助文档', ''),
        ),
        SliverToBoxAdapter(
          child: _buildMenuItem(context, Icons.info_outline, '关于我们', ''),
        ),

        // 隐私与账号：原来 App 里没有隐私政策链接，也没有注销入口
        SliverToBoxAdapter(child: _buildSectionTitle('隐私与账号')),
        SliverToBoxAdapter(
          child: _buildLinkItem(context, Icons.privacy_tip_outlined, '隐私政策', AppConfig.privacyUrl),
        ),
        SliverToBoxAdapter(
          child: _buildLinkItem(context, Icons.description_outlined, '用户协议', AppConfig.termsUrl),
        ),
        SliverToBoxAdapter(child: _buildDeleteAccountItem(context, ref)),

        SliverToBoxAdapter(child: _buildLogoutButton(context, ref)),

        const SliverToBoxAdapter(child: SizedBox(height: 100)),
      ],
    );
  }

  Widget _buildHeader(BuildContext context, User user) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          const Text('👤', style: TextStyle(fontSize: 28)),
          const SizedBox(height: 16),
          // Avatar
          CircleAvatar(
            radius: 50,
            backgroundColor: Theme.of(
              context,
            ).primaryColor.withValues(alpha: 0.1),
            backgroundImage: user.avatar != null
                ? NetworkImage(user.avatar!)
                : null,
            child: user.avatar == null
                ? Text(
                    user.name.substring(0, 1),
                    style: TextStyle(
                      fontSize: 32,
                      color: Theme.of(context).primaryColor,
                    ),
                  )
                : null,
          ),
          const SizedBox(height: 12),
          Text(
            user.name,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: _getPlanColor(user.plan).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              user.planText,
              style: TextStyle(
                color: _getPlanColor(user.plan),
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _getPlanColor(String plan) {
    switch (plan) {
      case 'enterprise':
        return Colors.purple;
      case 'pro':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  Widget _buildUpgradeBanner(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.orange.shade400, Colors.red.shade400],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.rocket_launch, color: Colors.white, size: 32),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '升级到 Pro',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                Text(
                  '解锁更多功能',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.8)),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: () {
              // TODO: Navigate to upgrade
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: Colors.orange,
            ),
            child: const Text('立即升级'),
          ),
        ],
      ),
    );
  }

  Widget _buildUsageSection(BuildContext context, User user) {
    return Container(
      margin: const EdgeInsets.all(20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '📊 使用量',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          // API Usage
          Row(
            children: [
              const Icon(Icons.api, color: Colors.blue, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('API 调用', style: TextStyle(fontSize: 14)),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: user.apiUsage / user.apiLimit,
                        backgroundColor: Colors.grey.shade200,
                        valueColor: AlwaysStoppedAnimation(
                          user.apiUsage / user.apiLimit > 0.8
                              ? Colors.red
                              : Colors.blue,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '${_formatNumber(user.apiUsage)}/${_formatNumber(user.apiLimit)}',
                style: const TextStyle(fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 20),
          // Storage Usage
          Row(
            children: [
              const Icon(Icons.storage, color: Colors.green, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('存储空间', style: TextStyle(fontSize: 14)),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: user.storageUsage / user.storageLimit,
                        backgroundColor: Colors.grey.shade200,
                        valueColor: AlwaysStoppedAnimation(
                          user.storageUsage / user.storageLimit > 0.8
                              ? Colors.red
                              : Colors.green,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '${user.storageUsage}MB/${user.storageLimit}MB',
                style: const TextStyle(fontSize: 12),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: Colors.grey,
        ),
      ),
    );
  }

  Widget _buildMenuItem(
    BuildContext context,
    IconData icon,
    String title,
    String subtitle,
  ) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Theme.of(context).primaryColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: Theme.of(context).primaryColor),
        ),
        title: Text(title),
        subtitle: subtitle.isNotEmpty ? Text(subtitle) : null,
        trailing: const Icon(Icons.chevron_right, color: Colors.grey),
        onTap: () {
          // TODO: Navigate
        },
      ),
    );
  }

  /// 隐私政策 / 用户协议：显示网页地址并可复制（App 暂未引入浏览器跳转依赖）。
  Widget _buildLinkItem(BuildContext context, IconData icon, String title, String url) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).primaryColor),
        title: Text(title),
        subtitle: Text(url, maxLines: 1, overflow: TextOverflow.ellipsis),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey),
        onTap: () => showDialog(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: Text(title),
            content: SelectableText('请在浏览器中打开：\n$url'),
            actions: [
              TextButton(
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: url));
                  if (dialogContext.mounted) Navigator.pop(dialogContext);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('链接已复制')));
                  }
                },
                child: const Text('复制链接'),
              ),
              TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('关闭')),
            ],
          ),
        ),
      ),
    );
  }

  /// 注销账号：调用后端已有的注销接口（不可恢复）。手机号注册或需要短信验证的账号，引导到网页端注销。
  Widget _buildDeleteAccountItem(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: const Icon(Icons.person_remove_outlined, color: Colors.red),
        title: const Text('注销账号', style: TextStyle(color: Colors.red)),
        subtitle: const Text('永久删除账号与个人信息，不可恢复'),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey),
        onTap: () => _confirmDeleteAccount(context, ref),
      ),
    );
  }

  Future<void> _confirmDeleteAccount(BuildContext context, WidgetRef ref) async {
    final passwordController = TextEditingController();
    var acknowledged = false;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setState) => AlertDialog(
          title: const Text('注销账号'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('注销后账号、内容与个人信息将被删除且无法恢复；订单与支付记录依法保留。'),
                const SizedBox(height: 12),
                TextField(
                  controller: passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: '登录密码（手机号注册的账号可不填）', border: OutlineInputBorder()),
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: acknowledged,
                  onChanged: (v) => setState(() => acknowledged = v ?? false),
                  title: const Text('我已了解注销后果'),
                ),
                const SizedBox(height: 4),
                SelectableText('也可以在网页端「设置 → 账号与数据」中注销：${AppConfig.accountSettingsUrl}',
                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('取消')),
            TextButton(
              onPressed: acknowledged ? () => Navigator.pop(dialogContext, true) : null,
              child: const Text('确认注销', style: TextStyle(color: Colors.red)),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(apiClientProvider).deleteAccount(password: passwordController.text);
      ref.invalidate(authStateProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('账号已注销')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyError(e, fallback: '注销失败，请稍后重试，或到网页端「设置 → 账号与数据」注销'))),
        );
      }
    }
  }

  Widget _buildLogoutButton(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.all(20),
      child: SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: () {
            showDialog(
              context: context,
              builder: (context) => AlertDialog(
                title: const Text('退出登录'),
                content: const Text('确定要退出登录吗?'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('取消'),
                  ),
                  TextButton(
                    onPressed: () async {
                      Navigator.pop(context);
                      await ref.read(apiClientProvider).clearToken();
                      ref.invalidate(authStateProvider);
                      if (context.mounted) {
                        ScaffoldMessenger.of(
                          context,
                        ).showSnackBar(const SnackBar(content: Text('已退出登录')));
                      }
                    },
                    child: const Text(
                      '确定',
                      style: TextStyle(color: Colors.red),
                    ),
                  ),
                ],
              ),
            );
          },
          icon: const Icon(Icons.logout, color: Colors.red),
          label: const Text('退出登录', style: TextStyle(color: Colors.red)),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
            side: const BorderSide(color: Colors.red),
          ),
        ),
      ),
    );
  }

  String _formatNumber(int number) {
    if (number >= 10000) {
      return '${(number / 10000).toStringAsFixed(1)}w';
    } else if (number >= 1000) {
      return '${(number / 1000).toStringAsFixed(1)}k';
    }
    return number.toString();
  }
}
