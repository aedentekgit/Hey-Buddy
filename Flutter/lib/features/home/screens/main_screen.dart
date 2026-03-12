
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

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 1; // Default to Buddy Assistant
  final List<int> _tabHistory = [1];
  bool _isSettingsSubPage = false;

  late final List<Widget> _pages;

  void _updateTab(int index) {
    setState(() {
      _currentIndex = index;
      if (_tabHistory.isEmpty || _tabHistory.last != index) {
        _tabHistory.add(index);
      }
    });

    if (index == 0) {
      Future.microtask(() {
        if (mounted) {
          Provider.of<TasksProvider>(context, listen: false).loadTasks(silent: true);
          Provider.of<MemoriesProvider>(context, listen: false).loadMemories(silent: true);
        }
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _requestLocationPermission();

    _pages = [
      ExploreScreen(
        onMemoryTap: () => Navigator.push(context, MaterialPageRoute(builder: (context) => const MemoryListScreen())),
        onReminderTap: () => Navigator.push(context, MaterialPageRoute(builder: (context) => const ReminderListScreen())),
      ),
      BuddyAssistantPage(
        isIntegrated: true,
        onClose: () {
          final auth = Provider.of<AuthProvider>(context, listen: false);
          if (auth.token != null) {
            _updateTab(3); // Go to Settings
          } else {
            Navigator.push(context, MaterialPageRoute(builder: (context) => const LoginScreen()));
          }
        },
        onExplore: () => _onTabTapped(0), // Go to Explore
      ),
      const MemoryListScreen(), 
      AccountSettingsScreen(
        onSubViewChanged: (isSubPage) {
          setState(() {
            _isSettingsSubPage = isSubPage;
          });
        },
      ),
    ];
  }

  void _onTabTapped(int index) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null && index != 1) {
      Navigator.push(context, MaterialPageRoute(builder: (context) => const LoginScreen()));
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
    bool showHeader = !(_currentIndex == 3 && _isSettingsSubPage);

    return PopScope(
      canPop: _tabHistory.length <= 1,
      onPopInvoked: (didPop) {
        if (didPop) return;
        setState(() {
          if (_tabHistory.length > 1) {
            _tabHistory.removeLast();
            _currentIndex = _tabHistory.last;
          }
        });
      },
      child: Scaffold(
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                primaryColor.withOpacity(0.08),
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
                      final auth = Provider.of<AuthProvider>(context, listen: false);
                      if (auth.token != null) {
                        _updateTab(3);
                      } else {
                        Navigator.push(context, MaterialPageRoute(builder: (context) => const LoginScreen()));
                      }
                    },
                  ),
                Expanded(
                  child: IndexedStack(
                    index: _currentIndex,
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
}

