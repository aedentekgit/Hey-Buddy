import 'package:buddy_mobile/core/config/app_config.dart';

String? imageUrlFrom(dynamic value) {
  final rawValue = value?.toString();
  if (rawValue == null) return null;
  final raw = rawValue.trim();
  if (raw.isEmpty) return null;
  return AppConfig.formatImageUrl(raw);
}

String safeInitial(dynamic value, {String fallback = 'U'}) {
  final rawValue = value?.toString();
  if (rawValue == null) return fallback;
  final raw = rawValue.trim();
  if (raw.isEmpty) return fallback;
  return raw.substring(0, 1).toUpperCase();
}

String safeInitials(dynamic value, {String fallback = 'U'}) {
  final rawValue = value?.toString();
  if (rawValue == null) return fallback;
  final raw = rawValue.trim();
  if (raw.isEmpty) return fallback;

  final parts = raw.split(RegExp(r'\s+')).where((part) => part.isNotEmpty).toList();
  if (parts.isEmpty) return fallback;
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();

  return '${parts[0].substring(0, 1)}${parts[1].substring(0, 1)}'.toUpperCase();
}
