import 'package:flutter/foundation.dart';
import 'package:geocoding/geocoding.dart';

void main() async {
  List<Placemark> placemarks = await placemarkFromCoordinates(9.919, 78.1195);
  debugPrint(placemarks[0].toString());
}
