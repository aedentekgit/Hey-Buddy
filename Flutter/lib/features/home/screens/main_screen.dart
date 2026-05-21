import 'package:flutter/material.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
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
import 'package:buddy_mobile/core/providers/security_provider.dart';
import 'package:buddy_mobile/shared/dialogs/biometric_prompt_dialog.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:cached_network_image/cached_network_image.dart';

class MainScreen extends StatefulWidget {
  final int initialIndex;
  const MainScreen({super.key, this.initialIndex = 1}); // Default to Explore

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  late int _currentIndex;
  late PageController _pageController;
  late final List<int> _tabHistory;
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
    // Notify the overlay so it can show/hide
    // _tabIndexNotifier.value = index;

    if (index == 1) { // Explore is index 1
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
    _currentIndex = widget.initialIndex;
    _tabHistory = [widget.initialIndex];
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
        onExplore: () => _onTabTapped(1), // Go to Explore (index 1)
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
    Future.microtask(() {
      if (!mounted) return;
      final auth = Provider.of<AuthProvider>(context, listen: false);
      if (auth.token != null) {
        Provider.of<UserProvider>(context, listen: false).loadProfile();
      }
      auth.addListener(_onAuthChanged);
    });
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
    if (auth.token == null && index != 0) { // Index 0 is Buddy (guest allowed)
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
    // Listen to branding for reactive overlay rebuilds
    Provider.of<BrandingProvider>(context);
    bool showHeader = !(_currentIndex == 2 && _isSettingsSubPage);

    return PopScope(
      canPop: _tabHistory.length <= 1,
      onPopInvokedWithResult: (didPop, _) {
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
        backgroundColor: AppColors.bg,
        body: SafeArea(
          left: false,
          right: false,
          bottom: false,
          child: Stack(
            children: [
              Column(
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
                        final auth = Provider.of<AuthProvider>(context, listen: false);
                        if (auth.token == null && index != 0) {
                          // User is logged out and swiped to a protected tab.
                          _pageController.jumpToPage(0);
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const LoginScreen()),
                          );
                          return;
                        }

                        setState(() {
                          _currentIndex = index;
                          if (_tabHistory.isEmpty || _tabHistory.last != index) {
                            _tabHistory.add(index);
                          }
                        });
                      },
                      physics: Provider.of<AuthProvider>(context).token == null 
                          ? const NeverScrollableScrollPhysics() 
                          : const BouncingScrollPhysics(),
                      children: _pages,
                    ),
                  ),
                ],
              ),
              
              // ── Floating Buddy Button (FAB Replacement) ──────────────────
              // Only show if not on AI Assistant page (index 0) and logged in
              if (_currentIndex != 0 && Provider.of<AuthProvider>(context).token != null)
                Positioned(
                  bottom: 28,
                  right: 16,
                  child: GestureDetector(
                    onTap: () => _updateTab(0),
                    child: Consumer<BrandingProvider>(
                      builder: (context, branding, _) => Container(
                        width: 60,
                        height: 60,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                        ),
                        child: ClipOval(
                          child: branding.logoUrl != null && branding.logoUrl!.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: branding.logoUrl!,
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) => Container(
                                    color: branding.primaryColor.withValues(alpha: 0.1),
                                    child: Center(
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: branding.primaryColor,
                                      ),
                                    ),
                                  ),
                                  errorWidget: (context, url, error) => Image.asset(
                                    'assets/images/buddy_logo.png',
                                    fit: BoxFit.cover,
                                  ),
                                )
                              : Image.asset(
                                  'assets/images/buddy_logo.png',
                                  fit: BoxFit.cover,
                                ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }


  Future<void> _checkBiometrics() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null) return;

    final security = Provider.of<SecurityProvider>(context, listen: false);
    if (security.isHardwareAvailable && !security.isBiometricEnabled) {
      final prompted = await security.hasBeenPrompted();
      if (!prompted) {
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
