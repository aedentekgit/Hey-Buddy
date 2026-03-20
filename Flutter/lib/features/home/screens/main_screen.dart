// ignore_for_file: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:buddy_mobile/features/voice_assistant/screens/buddy_assistant_page.dart';
import 'package:buddy_mobile/features/explore/screens/explore_screen.dart';
import 'package:buddy_mobile/features/home/screens/reminder_list_screen.dart';
import 'package:buddy_mobile/features/home/screens/memory_list_screen.dart';
import 'package:buddy_mobile/shared/widgets/mobile_app_header.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/home/providers/memories_provider.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';
import 'package:buddy_mobile/features/account/screens/account_settings_screen.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:buddy_mobile/features/auth/screens/login_screen.dart';
import 'package:geolocator/geolocator.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/core/providers/security_provider.dart';
import 'package:buddy_mobile/shared/dialogs/biometric_prompt_dialog.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0; // Default to Buddy Assistant (now at index 0)
  late PageController _pageController;
  final List<int> _tabHistory = [0];
  bool _isSettingsSubPage = false;

  late final List<Widget> _pages;

  void _updateTab(int index) {
    if (_currentIndex == index) return;
    
    setState(() {
      _currentIndex = index;
      if (_tabHistory.isEmpty || _tabHistory.last != index) {
        _tabHistory.add(index);
      }
    });

    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );

    if (index == 1) { // Now Explore is index 1
      Future.microtask(() {
        if (mounted) {
          Provider.of<TasksProvider>(
            context,
            listen: false,
          ).loadTasks(silent: true);
          Provider.of<MemoriesProvider>(
            context,
            listen: false,
          ).loadMemories(silent: true);
        }
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _currentIndex);
    _requestLocationPermission();
    _checkBiometrics();

    _pages = [
      BuddyAssistantPage(
        isIntegrated: true,
        onClose: () {
          final auth = Provider.of<AuthProvider>(context, listen: false);
          if (auth.token != null) {
            _updateTab(2); // Go to Settings
          } else {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const LoginScreen()),
            );
          }
        },
        onExplore: () => _onTabTapped(1), // Go to Explore (now index 1)
      ),
      ExploreScreen(
        onMemoryTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const MemoryListScreen()),
        ),
        onReminderTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const ReminderListScreen()),
        ),
      ),
      AccountSettingsScreen(
        onSubViewChanged: (isSubPage) {
          setState(() {
            _isSettingsSubPage = isSubPage;
          });
        },
      ),
    ];

    // Initial profile load for auto-login
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token != null) {
      Provider.of<UserProvider>(context, listen: false).loadProfile();
    }
    
    // Listen for auth changes to load/clear profile
    auth.addListener(_onAuthChanged);
  }

  void _onAuthChanged() {
    if (!mounted) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    
    if (auth.token != null && userProvider.user.isEmpty) {
      userProvider.loadProfile();
    } else if (auth.token == null && userProvider.user.isNotEmpty) {
      userProvider.clearUser();
    }
  }

  @override
  void dispose() {
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      auth.removeListener(_onAuthChanged);
    } catch (_) {}
    _pageController.dispose();
    super.dispose();
  }

  void _onTabTapped(int index) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null && index != 0) { // Index 0 is Buddy (Assistant)
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
      return;
    }
    _updateTab(index);
  }

  Future<void> _requestLocationPermission() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        await Geolocator.requestPermission();
      }
    } catch (e) {
      debugPrint("Location permission request failed: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    final branding = Provider.of<BrandingProvider>(context);
    final primaryColor = branding.primaryColor;
    bool showHeader = !(_currentIndex == 2 && _isSettingsSubPage);

    return PopScope(
      canPop: _tabHistory.length <= 1,
      onPopInvoked: (didPop) {
        if (didPop) return;
        if (_tabHistory.length > 1) {
          setState(() {
            _tabHistory.removeLast();
            _currentIndex = _tabHistory.last;
          });
          _pageController.animateToPage(
            _currentIndex,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        }
      },
      child: Scaffold(
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                primaryColor.withValues(alpha: 0.08),
                const Color(0xFFF9FAFF),
                const Color(0xFFF9FAFF),
              ],
              stops: const [0.0, 0.4, 1.0],
            ),
          ),
          child: SafeArea(
            left: false,
            right: false,
            child: Column(
              children: [
                if (showHeader)
                  MobileAppHeader(
                    currentIndex: _currentIndex,
                    onTabTapped: _onTabTapped,
                    onProfileTapped: () {
                      final auth = Provider.of<AuthProvider>(
                        context,
                        listen: false,
                      );
                      if (auth.token != null) {
                        _updateTab(2);
                      } else {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const LoginScreen(),
                          ),
                        );
                      }
                    },
                  ),
                Expanded(
                  child: PageView(
                    controller: _pageController,
                    onPageChanged: (index) {
                      setState(() {
                        _currentIndex = index;
                        if (_tabHistory.isEmpty || _tabHistory.last != index) {
                          _tabHistory.add(index);
                        }
                      });
                    },
                    physics: const BouncingScrollPhysics(),
                    children: _pages,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _checkBiometrics() async {
    // Only prompt if logged in
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null) return;

    final security = Provider.of<SecurityProvider>(context, listen: false);
    if (security.isHardwareAvailable && !security.isBiometricEnabled) {
      final prompted = await security.hasBeenPrompted();
      if (!prompted) {
        // Wait a bit for the UI to settle
        await Future.delayed(const Duration(seconds: 2));
        if (!mounted) return;

        final bool? result = await showDialog<bool>(
          context: context,
          builder: (context) => const BiometricPromptDialog(),
        );

        if (result == true) {
          await security.toggleBiometric(true);
        }
        await security.setPrompted();
      }
    }
  }
}
