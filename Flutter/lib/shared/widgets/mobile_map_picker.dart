import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:geolocator/geolocator.dart';

class MobileMapPicker extends StatefulWidget {
  final Map<String, dynamic>? initialCoordinates;
  final Function(Map<String, dynamic> coordinates, String address)
  onLocationSelected;

  const MobileMapPicker({
    super.key,
    this.initialCoordinates,
    required this.onLocationSelected,
  });

  @override
  State<MobileMapPicker> createState() => _MobileMapPickerState();
}

class _MobileMapPickerState extends State<MobileMapPicker> {
  GoogleMapController? _mapController;
  LatLng? _selectedLocation;
  Set<Marker> _markers = {};

  @override
  void initState() {
    super.initState();
    if (widget.initialCoordinates != null &&
        widget.initialCoordinates!['lat'] != null &&
        widget.initialCoordinates!['lng'] != null) {
      _selectedLocation = LatLng(
        widget.initialCoordinates!['lat'],
        widget.initialCoordinates!['lng'],
      );
      _updateMarkers(_selectedLocation!);
    }
  }

  void _updateMarkers(LatLng pos) {
    setState(() {
      _markers = {
        Marker(
          markerId: const MarkerId('selected'),
          position: pos,
          icon: BitmapDescriptor.defaultMarkerWithHue(
            BitmapDescriptor.hueViolet,
          ),
        ),
      };
    });
  }

  Future<void> _handleMapTap(LatLng pos) async {
    setState(() {
      _selectedLocation = pos;
    });
    _updateMarkers(pos);

    // In a real app, we'd reverse geocode here using geocoding package
    widget.onLocationSelected(
      {'lat': pos.latitude, 'lng': pos.longitude},
      "Custom Location (${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)})",
    );
  }

  Future<void> _goToCurrentLocation() async {
    try {
      Position position = await Geolocator.getCurrentPosition();
      LatLng currentPos = LatLng(position.latitude, position.longitude);
      _mapController?.animateCamera(CameraUpdate.newLatLngZoom(currentPos, 15));
      _handleMapTap(currentPos);
    } catch (e) {
      debugPrint("Error getting current location: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 240,
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.hardEdge,
      child: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: _selectedLocation ?? const LatLng(37.7749, -122.4194),
              zoom: 14,
            ),
            onMapCreated: (controller) => _mapController = controller,
            markers: _markers,
            onTap: _handleMapTap,
            zoomControlsEnabled: false,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            mapToolbarEnabled: false,
          ),
          Positioned(
            top: 12,
            right: 12,
            child: FloatingActionButton.small(
              heroTag: 'loc_btn',
              onPressed: _goToCurrentLocation,
              backgroundColor: Colors.white,
              foregroundColor: Theme.of(context).primaryColor,
              child: const Icon(LucideIcons.target),
            ),
          ),
          if (_selectedLocation == null)
            Center(
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  "Tap to select location",
                  style: TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
