import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/providers.dart';
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
      title: 'ContentFlow Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6366F1), // Indigo
          brightness: Brightness.light,
        ),
        fontFamily: 'SF Pro Text',
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authAsync = ref.watch(authStateProvider);

    return authAsync.when(
      data: (isAuthed) => isAuthed ? const MainScreen() : const LoginScreen(),
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) =>
          Scaffold(body: Center(child: Text('Authentication failed: $error'))),
    );
  }
}

class MainScreen extends ConsumerWidget {
  const MainScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentTab = ref.watch(currentTabProvider);

    return Scaffold(
      body: IndexedStack(
        index: currentTab,
        children: const [
          TodayScreen(),
          CreateScreen(),
          AssetsScreen(),
          InsightsScreen(),
          AccountScreen(),
        ],
      ),
      bottomNavigationBar: _buildBottomNav(context, ref, currentTab),
    );
  }

  Widget _buildBottomNav(BuildContext context, WidgetRef ref, int currentTab) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
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
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(context, ref, 0, Icons.today, 'Today', currentTab),
              _buildNavItem(
                context,
                ref,
                1,
                Icons.add_circle_outline,
                'Create',
                currentTab,
              ),
              _buildNavItem(
                context,
                ref,
                2,
                Icons.folder_outlined,
                'Assets',
                currentTab,
              ),
              _buildNavItem(
                context,
                ref,
                3,
                Icons.insights_outlined,
                'Insights',
                currentTab,
              ),
              _buildNavItem(
                context,
                ref,
                4,
                Icons.person_outline,
                'Account',
                currentTab,
              ),
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
    final color = isSelected ? Theme.of(context).primaryColor : Colors.grey;

    return GestureDetector(
      onTap: () {
        ref.read(currentTabProvider.notifier).state = index;
      },
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
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
