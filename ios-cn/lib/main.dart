import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/app_theme.dart';
import 'core/providers.dart';
import 'features/auth/auth_failure_page.dart';
import 'features/today/today_screen.dart';
import 'features/create/create_screen.dart';
import 'features/assets/assets_screen.dart';
import 'features/insights/insights_screen.dart';
import 'features/account/account_screen.dart';
import 'features/auth/login_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize SharedPreferences
  final prefs = await SharedPreferences.getInstance();

  runApp(
    ProviderScope(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      child: const ContentFlowApp(),
    ),
  );
}

// SharedPreferences Provider
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('SharedPreferences must be overridden');
});

class ContentFlowApp extends StatelessWidget {
  const ContentFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '分发侠',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      builder: (context, child) {
        final wide = MediaQuery.sizeOf(context).shortestSide >= 600;
        final base = MediaQuery.textScalerOf(context).scale(1);
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(base * (wide ? 1.2 : 1)),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
      home: const AuthGate(),
    );
  }
}

class AuthGate extends ConsumerStatefulWidget {
  const AuthGate({super.key});

  @override
  ConsumerState<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends ConsumerState<AuthGate> {
  bool _forceLogin = false;

  @override
  Widget build(BuildContext context) {
    if (_forceLogin) return const LoginScreen();
    final authAsync = ref.watch(authStateProvider);

    return authAsync.when(
      data: (isAuthed) => isAuthed ? const MainScreen() : const LoginScreen(),
      loading: () => Scaffold(
        backgroundColor: AppColors.page(context),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => AuthFailurePage(
        onRetry: () => ref.invalidate(authStateProvider),
        onRelogin: () {
          setState(() => _forceLogin = true);
          ref.read(tokenStorageProvider).clearToken();
        },
      ),
    );
  }
}

class MainScreen extends ConsumerWidget {
  const MainScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentTab = ref.watch(currentTabProvider);

    final pages = const [
      TodayScreen(),
      CreateScreen(),
      AssetsScreen(),
      InsightsScreen(),
      AccountScreen(),
    ];
    final wide = MediaQuery.sizeOf(context).width >= 900;
    if (wide) {
      return Scaffold(
        backgroundColor: AppColors.page(context),
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: currentTab,
              onDestinationSelected: (index) => ref.read(currentTabProvider.notifier).state = index,
              labelType: NavigationRailLabelType.all,
              backgroundColor: AppColors.card(context),
              destinations: const [
                NavigationRailDestination(icon: Icon(Icons.today_outlined), selectedIcon: Icon(Icons.today), label: Text('今日')),
                NavigationRailDestination(icon: Icon(Icons.add_circle_outline), selectedIcon: Icon(Icons.add_circle), label: Text('创作')),
                NavigationRailDestination(icon: Icon(Icons.folder_outlined), selectedIcon: Icon(Icons.folder), label: Text('素材')),
                NavigationRailDestination(icon: Icon(Icons.insights_outlined), selectedIcon: Icon(Icons.insights), label: Text('复盘')),
                NavigationRailDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: Text('我的')),
              ],
            ),
            const VerticalDivider(width: 1),
            Expanded(child: PageFrame(maxWidth: 960, child: pages[currentTab])),
          ],
        ),
      );
    }
    return Scaffold(
      body: PageFrame(child: IndexedStack(index: currentTab, children: pages)),
      bottomNavigationBar: _buildBottomNav(context, ref, currentTab),
    );
  }

  Widget _buildBottomNav(BuildContext context, WidgetRef ref, int currentTab) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card(context),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Row(
            children: [
              Expanded(child: _buildNavItem(context, ref, 0, Icons.today, '今日', currentTab)),
              Expanded(child: _buildNavItem(context, ref, 1, Icons.add_circle_outline, '创作', currentTab)),
              Expanded(child: _buildNavItem(context, ref, 2, Icons.folder_outlined, '素材', currentTab)),
              Expanded(child: _buildNavItem(context, ref, 3, Icons.insights_outlined, '复盘', currentTab)),
              Expanded(child: _buildNavItem(context, ref, 4, Icons.person_outline, '我的', currentTab)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context,
    WidgetRef ref,
    int index,
    IconData icon,
    String label,
    int currentTab,
  ) {
    final isSelected = currentTab == index;
    final color = isSelected ? Theme.of(context).colorScheme.primary : AppColors.muted(context);

    return GestureDetector(
      onTap: () {
        ref.read(currentTabProvider.notifier).state = index;
      },
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? Theme.of(context).primaryColor.withValues(alpha: 0.1)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
