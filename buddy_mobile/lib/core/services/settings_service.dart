import 'package:dio/dio.dart';
import 'package:buddy_mobile/core/config/app_config.dart';

class SettingsService {
  final Dio _dio = Dio(BaseOptions(baseUrl: AppConfig.baseUrl));

  Future<Map<String, dynamic>> getPublicSettings() async {
    try {
      final response = await _dio.get('/settings/public');
      return response.data;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }
}
