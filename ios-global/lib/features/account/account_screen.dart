import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../data/models.dart';

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
          error: (e, _) => Center(child: Text('Failed to load: $e')),
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
        SliverToBoxAdapter(child: _buildSectionTitle('Features')),
        SliverToBoxAdapter(child: _buildMenuItem(context, Icons.people, 'Team management', 'Manage team members')),
        SliverToBoxAdapter(child: _buildMenuItem(context, Icons.key, 'API settings', 'Manage API keys')),
        
        SliverToBoxAdapter(child: _buildSectionTitle('Settings')),
        SliverToBoxAdapter(child: _buildMenuItem(context, Icons.settings, 'App settings', '')),
        SliverToBoxAdapter(child: _buildMenuItem(context, Icons.help_outline, 'Help', '')),
        SliverToBoxAdapter(child: _buildMenuItem(context, Icons.info_outline, 'About', '')),
        
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
            backgroundColor: Theme.of(context).primaryColor.withValues(alpha: 0.1),
            backgroundImage: user.avatar != null ? NetworkImage(user.avatar!) : null,
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
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
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
                  'Upgrade to Pro',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                Text(
                  'Unlock more features',
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
            child: const Text('Upgrade now'),
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
            '📊 Usage',
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
                    const Text('API calls', style: TextStyle(fontSize: 14)),
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
                    const Text('Storage', style: TextStyle(fontSize: 14)),
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

  Widget _buildMenuItem(BuildContext context, IconData icon, String title, String subtitle) {
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
                title: const Text('Sign out'),
                content: const Text('Are you sure you want to sign out?'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                  TextButton(
                    onPressed: () async {
                      Navigator.pop(context);
                      await ref.read(apiClientProvider).clearToken();
                      ref.invalidate(authStateProvider);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Signed out')),
                        );
                      }
                    },
                    child: const Text('Confirm', style: TextStyle(color: Colors.red)),
                  ),
                ],
              ),
            );
          },
          icon: const Icon(Icons.logout, color: Colors.red),
          label: const Text('Sign out', style: TextStyle(color: Colors.red)),
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
