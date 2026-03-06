import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/shared/utils/update_utils.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:buddy_mobile/main.dart'; // To access globalNavigatorKey

class UpdateWrapper extends StatefulWidget {
  final Widget child;

  const UpdateWrapper({super.key, required this.child});

  @override
  State<UpdateWrapper> createState() => _UpdateWrapperState();
}

class _UpdateWrapperState extends State<UpdateWrapper> with WidgetsBindingObserver {
  bool _isUpdateDialogShowing = false;
  String? _currentVersion;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initVersion();
  }

  Future<void> _initVersion() async {
    final packageInfo = await PackageInfo.fromPlatform();
    _currentVersion = packageInfo.version;
    _checkForUpdate();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final branding = Provider.of<BrandingProvider>(context, listen: false);
      branding.fetchBranding().then((_) {
        _checkForUpdate();
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Re-check anytime BrandingProvider updates
    _checkForUpdate();
  }

  void _checkForUpdate() {
    if (_isUpdateDialogShowing || _currentVersion == null) return;

    final branding = Provider.of<BrandingProvider>(context, listen: false);
    if (branding.latestAppVersion != null && branding.latestAppVersion!.isNotEmpty) {
      if (_isUpdateAvailable(_currentVersion!, branding.latestAppVersion!)) {
        if (branding.updateUrl != null && branding.updateUrl!.isNotEmpty) {
          _isUpdateDialogShowing = true;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _showUpdateDialog(branding.updateUrl!);
          });
        }
      }
    }
  }

  void _showUpdateDialog(String updateUrl) {
    // Attempt to use global navigator key for contexts outside standard app routing
    final navContext = globalNavigatorKey.currentContext ?? context;
    showInAppUpdateDialog(navContext, updateUrl);
  }

  bool _isUpdateAvailable(String current, String latest) {
    List<int> currentParts = current.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    List<int> latestParts = latest.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    
    for (int i = 0; i < 3; i++) {
        int c = i < currentParts.length ? currentParts[i] : 0;
        int l = i < latestParts.length ? latestParts[i] : 0;
        if (l > c) return true;
        if (l < c) return false;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    // We register dependency to BrandingProvider so it re-triggers didChangeDependencies on updates
    context.watch<BrandingProvider>();
    return widget.child;
  }
}
