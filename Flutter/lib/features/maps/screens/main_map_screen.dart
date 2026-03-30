import 'package:flutter/material.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';
import 'package:buddy_mobile/shared/widgets/mobile_header.dart';
import 'package:lucide_icons/lucide_icons.dart';

class MainMapScreen extends StatefulWidget {
  const MainMapScreen({super.key});

  @override
  State<MainMapScreen> createState() => _MainMapScreenState();
}

class _MainMapScreenState extends State<MainMapScreen> {
  GoogleMapController? _mapController;

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () {
        if (mounted) {
          Provider.of<TasksProvider>(context, listen: false).loadTasks();
        }
      },
    );
  }

  Set<Marker> _buildMarkers(List<dynamic> tasks) {
    return tasks.where((t) => t['coordinates'] != null).map((t) {
      final coords = t['coordinates'];
      return Marker(
        markerId: MarkerId(t['_id']),
        position: LatLng(
          (coords['lat'] as num).toDouble(),
          (coords['lng'] as num).toDouble(),
        ),
        infoWindow: InfoWindow(
          title: t['title'],
          snippet: "${t['time'] ?? 'All day'} - ${t['location'] ?? ''}",
        ),
        icon: BitmapDescriptor.defaultMarkerWithHue(
          t['status'] == 'completed'
              ? BitmapDescriptor.hueGreen
              : BitmapDescriptor.hueViolet,
        ),
      );
    }).toSet();
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    final provider = Provider.of<TasksProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            const MobileHeader(),
            Expanded(
              child: Stack(
                children: [
                  GoogleMap(
                    initialCameraPosition: CameraPosition(
                      target:
                          provider.tasks.any((t) => t['coordinates'] != null)
                          ? LatLng(
                              (provider.tasks.firstWhere(
                                (t) => t['coordinates'] != null,
                              )['coordinates']['lat'] as num).toDouble(),
                              (provider.tasks.firstWhere(
                                (t) => t['coordinates'] != null,
                              )['coordinates']['lng'] as num).toDouble(),
                            )
                          : const LatLng(20.5937, 78.9629), // Center of India
                      zoom: 12,
                    ),
                    onMapCreated: (controller) => _mapController = controller,
                    markers: _buildMarkers(provider.tasks),
                    myLocationEnabled: true,
                    zoomControlsEnabled: false,
                    mapToolbarEnabled: false,
                  ),
                  if (provider.isLoading)
                    const Center(child: CircularProgressIndicator()),

                  // Legend or Floating Action
                  Positioned(
                    bottom: 20,
                    right: 20,
                    child: FloatingActionButton(
                      onPressed: () {
                        if (provider.tasks.any(
                          (t) => t['coordinates'] != null,
                        )) {
                          final first = provider.tasks.firstWhere(
                            (t) => t['coordinates'] != null,
                          );
                          _mapController?.animateCamera(
                            CameraUpdate.newLatLngZoom(
                              LatLng(
                                (first['coordinates']['lat'] as num).toDouble(),
                                (first['coordinates']['lng'] as num).toDouble(),
                              ),
                              14,
                            ),
                          );
                        }
                      },
                      backgroundColor: Theme.of(context).primaryColor,
                      child: const Icon(
                        LucideIcons.navigation2,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
