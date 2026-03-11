import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:cached_network_image/cached_network_image.dart';

import 'package:buddy_mobile/core/services/location_service.dart';
import 'package:buddy_mobile/core/config/app_config.dart';


class MobileHeader extends StatefulWidget {
  const MobileHeader({super.key});

  @override
  State<MobileHeader> createState() => _MobileHeaderState();
}

class _MobileHeaderState extends State<MobileHeader> {
  bool _isSearchVisible = false;
  final TextEditingController _searchController = TextEditingController();
  String? _currentLocation;
  final LocationService _locationService = LocationService();
  StreamSubscription? _liveTrackingSubscription;

  @override
  void initState() {
    super.initState();
    _loadLocation();
  }

  Future<void> _loadLocation() async {
    final locationData = await _locationService.getCurrentLocation();
    if (locationData != null && mounted) {
      setState(() {
        _currentLocation = locationData['address'] as String?;
      });

      // Sync with backend via Provider
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      if (locationData['lat'] != null && locationData['lng'] != null) {
        userProvider.updateLocation(
          locationData['lat'] as double,
          locationData['lng'] as double,
        );
      }
      
      // Start background updates — store subscription so we can cancel on dispose.
      // The callback fires on every 50m position change and keeps both the
      // header text and UserProvider in sync so SmartDetailsPanel always has
      // the freshest coordinates as a fallback.
      _liveTrackingSubscription?.cancel();
      _liveTrackingSubscription = _locationService.startLiveTracking(
        onLocationUpdate: (String address, double lat, double lng) {
          if (!mounted) return;
          setState(() {
            _currentLocation = address;
          });
          Provider.of<UserProvider>(context, listen: false)
              .updateLocation(lat, lng);
        },
      );
    }
  }

  @override
  void dispose() {
    _liveTrackingSubscription?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final branding = Provider.of<BrandingProvider>(context);
    final userProvider = Provider.of<UserProvider>(context);
    final user = userProvider.user;
    final primaryColor = Theme.of(context).primaryColor;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, _isSearchVisible ? 12 : 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.9),
        border: Border(bottom: BorderSide(color: Colors.grey[200]!)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // User Profile & Info
              Expanded(
                child: Row(
                  children: [
                    // Avatar Box
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [primaryColor.withOpacity(0.8), primaryColor],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: primaryColor.withOpacity(0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          )
                        ],
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                      child: ClipOval(
                        child: AppConfig.formatImageUrl(user['profilePicture']) != null
                            ? CachedNetworkImage(
                                imageUrl: AppConfig.formatImageUrl(user['profilePicture'])!,
                                fit: BoxFit.cover,
                                errorWidget: (context, url, error) => const Icon(LucideIcons.user, color: Colors.white, size: 20),
                              )

                            : (branding.logoUrl != null 
                                ? CachedNetworkImage(imageUrl: branding.logoUrl!, fit: BoxFit.cover)
                                : const Icon(LucideIcons.user, color: Colors.white, size: 20)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    
                    // Text Info
                    Expanded(
                      child: _isSearchVisible 
                        ? const SizedBox.shrink() 
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                user['name'] ?? branding.appName, 
                                style: GoogleFonts.outfit(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF1E293B),
                                  height: 1.2,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  Icon(LucideIcons.mapPin, size: 10, color: primaryColor),
                                  const SizedBox(width: 4),
                                  Text(
                                    _currentLocation ?? "Locating...", 
                                    style: GoogleFonts.outfit(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: const Color(0xFF64748B),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ],
                          ),
                    ),
                  ],
                ),
              ),

              // Search Button
              InkWell(
                onTap: () {
                  setState(() {
                    _isSearchVisible = !_isSearchVisible;
                    if (!_isSearchVisible) {
                      _searchController.clear();
                    }
                  });
                },
                borderRadius: BorderRadius.circular(10),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: _isSearchVisible ? primaryColor : Colors.grey[100],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _isSearchVisible ? primaryColor : Colors.grey[200]!),
                  ),
                  child: Icon(
                    _isSearchVisible ? LucideIcons.x : LucideIcons.search,
                    size: 18,
                    color: _isSearchVisible ? Colors.white : const Color(0xFF1E293B),
                  ),
                ),
              ),
            ],
          ),

          // Collapsible Search Bar
          if (_isSearchVisible)
             Padding(
               padding: const EdgeInsets.only(top: 12),
               child: TextField(
                 controller: _searchController,
                 autofocus: true,
                 style: GoogleFonts.outfit(fontSize: 14, color: Colors.black87),
                 decoration: InputDecoration(
                   hintText: "Ask anything...",
                   hintStyle: GoogleFonts.outfit(fontSize: 14, color: Colors.grey[400]),
                   prefixIcon: Icon(LucideIcons.search, size: 16, color: Colors.grey[400]),
                   contentPadding: const EdgeInsets.all(12),
                   fillColor: Colors.grey[50],
                   filled: true,
                   border: OutlineInputBorder(
                     borderRadius: BorderRadius.circular(10),
                     borderSide: BorderSide(color: Colors.grey[200]!),
                   ),
                   enabledBorder: OutlineInputBorder(
                     borderRadius: BorderRadius.circular(10),
                     borderSide: BorderSide(color: Colors.grey[200]!),
                   ),
                   focusedBorder: OutlineInputBorder(
                     borderRadius: BorderRadius.circular(10),
                     borderSide: BorderSide(color: primaryColor),
                   ),
                 ),
               ),
             ),
        ],
      ),
    );
  }
}
